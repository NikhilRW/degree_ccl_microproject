import { App, CfnOutput, Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as dynamodb from "aws-cdk-lib/as-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as deployment from "aws-cdk-lib/aws-s3-deployment";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { DynamoEventSource, SqsDlq } from "aws-cdk-lib/aws-lambda-event-sources";
import { HttpApi, HttpStage } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class StoreStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);
    const origin = this.node.tryGetContext("frontendOrigin") ?? "http://localhost:8000";
    const extraOrigins = this.node.tryGetContext("extraOrigins") ?? "http://localhost:5173";
    const origins = [
      ...new Set<string>(
        [origin, ...String(extraOrigins).split(",")].map((s) => s.trim()).filter(Boolean),
      ),
    ];
    const sender = this.node.tryGetContext("senderEmail");
    if (!sender)
      throw new Error("Set --context senderEmail=you@example.com to create the SES sender identity.");

    const table = new dynamodb.Table(this, "StoreData", {
      partitionKey: { name: "pk", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: "expiresAt",
      stream: dynamodb.StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    // Existing entity='order' records backfill automatically. No session data
    // is projected, and the retained StoreData construct/logical ID is unchanged.
    table.addGlobalSecondaryIndex({
      indexName: "OrdersByEntity",
      partitionKey: { name: "entity", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "sk", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.INCLUDE,
      nonKeyAttributes: ["data"],
    });
    const media = new s3.Bucket(this, "Media", {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: true,
      removalPolicy: RemovalPolicy.RETAIN,
      cors: [
        {
          allowedOrigins: origins,
          allowedMethods: [s3.HttpMethods.POST, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
          allowedHeaders: ["*"],
          maxAge: 600,
        },
      ],
    });
    const users = new cognito.UserPool(this, "Customers", {
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: true, mutable: true },
      },
      passwordPolicy: {
        minLength: 10,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: RemovalPolicy.RETAIN,
    });
    const client = users.addClient("Storefront", {
      generateSecret: false,
      disableOAuth: true,
      authFlows: { userPassword: true },
      preventUserExistenceErrors: true,
      enableTokenRevocation: true,
      accessTokenValidity: Duration.minutes(30),
      idTokenValidity: Duration.minutes(30),
      refreshTokenValidity: Duration.days(7),
      refreshTokenRotationGracePeriod: Duration.seconds(10),
    });
    new cognito.CfnUserPoolGroup(this, "Administrators", {
      userPoolId: users.userPoolId, groupName: "Admins",
      description: "Product creation, private product images, price editing and order status management. Membership is operator-managed.",
    });
    const identity = new ses.EmailIdentity(this, "Sender", {
      identity: ses.Identity.email(sender),
    });
    const environment = {
      TABLE_NAME: table.tableName,
      MEDIA_BUCKET: media.bucketName,
      COGNITO_CLIENT_ID: client.userPoolClientId,
      COGNITO_USER_POOL_ID: users.userPoolId,
      SENDER_EMAIL: sender,
    };
    const makeFunction = (name: string, entry: string) =>
      new NodejsFunction(this, name, {
        entry: path.join(root, "src", entry),
        projectRoot: root,
        depsLockFilePath: path.join(root, "package-lock.json"),
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "handler",
        timeout: Duration.seconds(20),
        memorySize: 512,
        environment,
        logGroup: new logs.LogGroup(this, `${name}Logs`, {
          retention: logs.RetentionDays.TWO_WEEKS,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
        bundling: { minify: true, sourceMap: true, format: OutputFormat.CJS, externalModules: [] },
      });
    const notifications = makeFunction("Notifications", "notifications.ts");
    identity.grantSendEmail(notifications);
    const failures = new sqs.Queue(this, "NotificationFailures", {
      retentionPeriod: Duration.days(14),
      encryption: sqs.QueueEncryption.SQS_MANAGED,
      enforceSSL: true,
    });
    notifications.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 10,
        retryAttempts: 3,
        bisectBatchOnError: true,
        reportBatchItemFailures: true,
        onFailure: new SqsDlq(failures),
        filters: [
          lambda.FilterCriteria.filter({
            eventName: ["INSERT"],
            dynamodb: { NewImage: { entity: { S: ["order"] } } },
          }),
        ],
      }),
    );
    // Optional resources-only first deployment: no placeholder URLs or fake
    // Lambda code. Build on any machine, then deploy normally to add the app.
    if (String(this.node.tryGetContext("resourcesOnly")) !== "true") {
      const output = path.resolve(root, "../.output");
      if (!existsSync(path.join(output, "nitro.json"))) throw new Error("Run bun run build at the repository root before synthesis, or use --context resourcesOnly=true for initial provisioning.");
      const manifest = JSON.parse(readFileSync(path.join(output, "nitro.json"), "utf8")) as {
        preset: string; serverEntry: string; publicDir: string;
      };
      if (manifest.preset !== "aws-lambda" || manifest.serverEntry !== "server/index.mjs" || manifest.publicDir !== "public")
        throw new Error("Unexpected Nitro output. Rebuild with the aws_lambda preset and inspect its handler layout.");
      const entry = readFileSync(path.join(output, manifest.serverEntry), "utf8");
      if (!/export\s*\{[^}]*\bhandler\b/.test(entry)) throw new Error("Nitro Lambda handler export is missing.");
      const assets = new s3.Bucket(this, "WebAssets", {
        encryption: s3.BucketEncryption.S3_MANAGED, blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        enforceSSL: true, removalPolicy: RemovalPolicy.RETAIN,
      });
      // Keep old hashed chunks across deploys so in-flight browser sessions work.
      const assetDeployment = new deployment.BucketDeployment(this, "PublishWebAssets", {
        sources: [deployment.Source.asset(path.join(output, manifest.publicDir))], destinationBucket: assets,
        prune: false, memoryLimit: 512,
      });
      const storefront = new lambda.Function(this, "StorefrontApp", {
        runtime: lambda.Runtime.NODEJS_22_X, architecture: lambda.Architecture.X86_64,
        code: lambda.Code.fromAsset(path.join(output, "server")), handler: "index.handler",
        memorySize: 1024, timeout: Duration.seconds(30),
        environment: { ...environment, NODE_ENV: "production", ASSET_BUCKET: assets.bucketName },
        logGroup: new logs.LogGroup(this, "StorefrontAppLogs", {
          retention: logs.RetentionDays.TWO_WEEKS, removalPolicy: RemovalPolicy.DESTROY,
        }),
      });
      table.grantReadWriteData(storefront);
      media.grantRead(storefront);
      media.grantReadWrite(storefront, "customers/*");
      media.grantWrite(storefront, "products/admin/*", ["s3:PutObject"]);
      assets.grantRead(storefront);
      // Cognito password/refresh/revoke/GetUser calls authorize using client ID
      // and Cognito tokens, not IAM. Only read current membership for admin RPCs;
      // the application cannot add users to groups or manage the user pool.
      users.grant(storefront, "cognito-idp:AdminListGroupsForUser");
      const api = new HttpApi(this, "StoreApi", {
        createDefaultStage: false,
        defaultIntegration: new HttpLambdaIntegration("StartIntegration", storefront),
      });
      new HttpStage(this, "ApiStage", {
        httpApi: api,
        stageName: "$default",
        autoDeploy: true,
        throttle: { burstLimit: 40, rateLimit: 20 },
      });
      // For browser uploads, set frontendOrigin to the resulting StorefrontUrl
      // on a subsequent update. Referring to it in Media CORS here would create
      // a bucket -> API -> function -> bucket CloudFormation dependency cycle.
      api.node.addDependency(assetDeployment);
      new CfnOutput(this, "StorefrontUrl", { value: api.apiEndpoint });
    }
    new CfnOutput(this, "TableName", { value: table.tableName });
    new CfnOutput(this, "MediaBucket", { value: media.bucketName });
    new CfnOutput(this, "UserPoolId", { value: users.userPoolId });
    new CfnOutput(this, "UserPoolClientId", { value: client.userPoolClientId });
    new CfnOutput(this, "Region", { value: this.region });
    new CfnOutput(this, "NotificationFailureQueue", { value: failures.queueUrl });
  }
}

const app = new App();
new StoreStack(app, "IntelliMartBackend", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "ap-south-1",
  },
});
