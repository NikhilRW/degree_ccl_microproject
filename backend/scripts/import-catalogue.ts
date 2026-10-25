import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { isDeepStrictEqual } from "node:util";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { catalogueRecords, validateCatalogue } from "./catalogue-schema";

const { values } = parseArgs({
  options: {
    file: { type: "string" },
    table: { type: "string" },
    region: { type: "string" },
    overwrite: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "skip-identical": { type: "boolean", default: false },
  },
});
if (!values.file || (!values.table && !values["dry-run"]))
  throw new Error(
    "Usage: npm run import:catalogue -- --file catalogue.json [--dry-run | --table TABLE_NAME] [--region REGION] [--overwrite]",
  );
const input = validateCatalogue(JSON.parse(await readFile(values.file, "utf8")));
const records = catalogueRecords(input);
if (values["dry-run"]) {
  console.log(`Validated ${input.products.length} products, ${input.categories.length} categories, ${input.reviews?.length ?? 0} reviews (${records.length} records). No AWS calls made.`);
} else {
  const client = DynamoDBDocumentClient.from(
    new DynamoDBClient({
      region: values.region ?? process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION,
    }),
  );
  try {
    let imported = 0;
    let skipped = 0;
    for (const record of records) {
      if (values["skip-identical"]) {
        const existing = await client.send(new GetCommand({
          TableName: values.table, Key: { pk: record.pk, sk: record.sk }, ConsistentRead: true,
        }));
        if (existing.Item) {
          if (!isDeepStrictEqual(existing.Item, record))
            throw new Error(`Refusing different existing record: ${record.pk}/${record.sk}.`);
          skipped++;
          continue;
        }
      }
      await client.send(
        new PutCommand({
          TableName: values.table,
          Item: record,
          ...(values.overwrite ? {} : { ConditionExpression: "attribute_not_exists(pk)" }),
        }),
      );
      console.log(`Imported ${record.sk}`);
      imported++;
    }
    console.log(`Imported ${imported} catalogue records into DynamoDB; kept ${skipped} identical existing records.`);
  } finally {
    client.destroy();
  }
}
