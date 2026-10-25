import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SESv2Client } from "@aws-sdk/client-sesv2";
import { getRuntimeConfig } from "./runtime.server";

let clients: ReturnType<typeof createClients> | undefined;
function createClients() {
  const { region } = getRuntimeConfig();
  // AWS's default credential chain: an EC2 role in deployment, a local AWS
  // profile/temporary environment credentials during development. Never a browser key.
  return {
    cognito: new CognitoIdentityProviderClient({ region }),
    db: DynamoDBDocumentClient.from(new DynamoDBClient({ region }), {
      marshallOptions: { removeUndefinedValues: true },
    }),
    s3: new S3Client({ region }),
    ses: new SESv2Client({ region }),
  };
}
export function getAwsClients() {
  return (clients ??= createClients());
}
