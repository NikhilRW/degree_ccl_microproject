import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import {
  DescribeUserPoolCommand,
  DescribeUserPoolClientCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import { HeadBucketCommand } from "@aws-sdk/client-s3";
import { GetEmailIdentityCommand } from "@aws-sdk/client-sesv2";
import { getAwsClients } from "../src/server/clients.server";
import { getRuntimeConfig } from "../src/server/runtime.server";

if (existsSync(".env")) loadEnvFile(".env");
const config = getRuntimeConfig();
if (config.mode !== "cloud") {
  console.log(
    "Demo configuration is valid. Switch to cloud mode after resource setup to check AWS.",
  );
} else {
  const clients = getAwsClients();
  const table = await clients.db.send(new DescribeTableCommand({ TableName: config.table }));
  if (
    !table.Table?.KeySchema?.some((key) => key.AttributeName === "PK" && key.KeyType === "HASH") ||
    !table.Table.KeySchema.some((key) => key.AttributeName === "SK" && key.KeyType === "RANGE")
  )
    throw new Error("DynamoDB requires PK (String) and SK (String).");
  if (
    !["PK", "SK"].every((name) =>
      table.Table?.AttributeDefinitions?.some(
        (attribute) => attribute.AttributeName === name && attribute.AttributeType === "S",
      ),
    )
  )
    throw new Error("DynamoDB PK and SK must both be String attributes.");
  await clients.cognito.send(new DescribeUserPoolCommand({ UserPoolId: config.userPoolId }));
  const poolClient = await clients.cognito.send(
    new DescribeUserPoolClientCommand({ UserPoolId: config.userPoolId, ClientId: config.clientId }),
  );
  if (poolClient.UserPoolClient?.ClientSecret)
    throw new Error("Use a Cognito app client without a secret.");
  const flows = poolClient.UserPoolClient?.ExplicitAuthFlows ?? [];
  if (!flows.includes("ALLOW_USER_PASSWORD_AUTH") || !flows.includes("ALLOW_REFRESH_TOKEN_AUTH"))
    throw new Error("Enable Cognito user-password and refresh-token auth flows.");
  if (poolClient.UserPoolClient?.RefreshTokenRotation?.Feature === "ENABLED")
    throw new Error(
      "This lab uses REFRESH_TOKEN_AUTH; disable refresh-token rotation for this app client.",
    );
  await clients.s3.send(new HeadBucketCommand({ Bucket: config.mediaBucket }));
  const sender = await clients.ses.send(
    new GetEmailIdentityCommand({ EmailIdentity: config.emailFrom }),
  );
  if (!sender.VerifiedForSendingStatus) throw new Error("SES sender is not verified.");
  console.log(
    "AWS identifiers, table keys, Cognito flow, S3 access, and SES sender checked. No secrets printed. Payment methods are simulated only; no payment provider is configured.",
  );
}
