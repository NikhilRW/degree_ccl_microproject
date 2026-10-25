import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { getAwsClients } from "./clients.server";
import { getRuntimeConfig } from "./runtime.server";
import { createDemoCatalogueStore } from "./catalogue-store.server";
import { orders } from "@/data/orders";
import { demoUser } from "@/data/users";

export interface Row<T = unknown> {
  kind: string;
  id: string;
  rev: number;
  value: T;
}
export interface Change {
  kind: string;
  id: string;
  expected: number | null;
  value: unknown | null;
}
export interface Records {
  get<T>(kind: string, id: string): Promise<Row<T> | null>;
  list<T>(kind: string): Promise<Row<T>[]>;
  page<T>(
    kind: string,
    cursor?: string,
    limit?: number,
    descending?: boolean,
  ): Promise<{ rows: Row<T>[]; cursor: string }>;
  transaction(changes: Change[]): Promise<void>;
}
export class ConflictError extends Error {
  constructor() {
    super("The record changed. Refresh and try again.");
    this.name = "ConflictError";
  }
}
const key = (kind: string, id: string) => JSON.stringify([kind, id]);

export function createFileRecords(file: string, seed: () => Promise<Row[]>): Records {
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(work: () => Promise<T>) => {
    const result = queue.then(work, work);
    queue = result.catch(() => undefined);
    return result;
  };
  async function load(): Promise<Row[]> {
    try {
      const stored = z
        .object({
          schemaVersion: z.literal(1),
          rows: z.array(
            z.object({
              kind: z.string(),
              id: z.string(),
              rev: z.number().int().nonnegative(),
              value: z.unknown(),
            }),
          ),
        })
        .parse(JSON.parse(await readFile(file, "utf8")));
      return stored.rows as Row[];
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
        return seed();
      throw new Error(
        "Cannot read application data. Back up and inspect the file; refusing to reset corrupted data.",
      );
    }
  }
  return {
    get: <T>(kind: string, id: string) =>
      exclusive(
        async () =>
          ((await load()).find((row) => row.kind === kind && row.id === id) as
            Row<T> | undefined) ?? null,
      ),
    list: <T>(kind: string) =>
      exclusive(
        async () =>
          (await load())
            .filter((row) => row.kind === kind)
            .sort((a, b) => a.id.localeCompare(b.id)) as Row<T>[],
      ),
    page: <T>(kind: string, cursor = "", limit = 100, descending = false) =>
      exclusive(async () => {
        const rows = (await load())
          .filter((row) => row.kind === kind)
          .sort((a, b) => (a.id === b.id ? 0 : (a.id < b.id ? -1 : 1) * (descending ? -1 : 1)));
        const filtered = cursor
          ? rows.filter((row) => (descending ? row.id < cursor : row.id > cursor))
          : rows;
        const page = filtered.slice(0, limit) as Row<T>[];
        return { rows: page, cursor: filtered.length > limit ? page.at(-1)!.id : "" };
      }),
    transaction: (changes) =>
      exclusive(async () => {
        validateChanges(changes);
        const rows = await load();
        const map = new Map(rows.map((row) => [key(row.kind, row.id), row]));
        for (const change of changes) {
          const current = map.get(key(change.kind, change.id));
          if ((current?.rev ?? null) !== change.expected) throw new ConflictError();
        }
        for (const change of changes) {
          if (change.value === null) map.delete(key(change.kind, change.id));
          else
            map.set(key(change.kind, change.id), {
              kind: change.kind,
              id: change.id,
              rev: (change.expected ?? 0) + 1,
              value: change.value,
            });
        }
        await mkdir(dirname(file), { recursive: true });
        const temporary = `${file}.${randomUUID()}.tmp`;
        await writeFile(
          temporary,
          JSON.stringify({ schemaVersion: 1, rows: [...map.values()] }, null, 2),
          { mode: 0o600 },
        );
        await rename(temporary, file);
      }),
  };
}

function validateChanges(changes: Change[]) {
  if (!changes.length || changes.length > 90) throw new Error("Invalid transaction size.");
  if (new Set(changes.map((change) => key(change.kind, change.id))).size !== changes.length)
    throw new Error("A transaction cannot update the same record twice.");
}

function createDynamoRecords(): Records {
  const table = getRuntimeConfig().table;
  function decode<T>(item: Record<string, unknown>): Row<T> {
    return {
      kind: String(item["PK"]),
      id: String(item["SK"]),
      rev: Number(item["rev"]),
      value: item["value"] as T,
    };
  }
  return {
    async get<T>(kind: string, id: string) {
      const result = await getAwsClients().db.send(
        new GetCommand({ TableName: table, Key: { PK: kind, SK: id }, ConsistentRead: true }),
      );
      return result.Item ? decode<T>(result.Item) : null;
    },
    async list<T>(kind: string) {
      const rows: Row<T>[] = [];
      let cursor: Record<string, unknown> | undefined;
      do {
        const result = await getAwsClients().db.send(
          new QueryCommand({
            TableName: table,
            KeyConditionExpression: "PK = :kind",
            ExpressionAttributeValues: { ":kind": kind },
            ConsistentRead: true,
            Limit: 100,
            ...(cursor ? { ExclusiveStartKey: cursor } : {}),
          }),
        );
        rows.push(...(result.Items ?? []).map((item) => decode<T>(item)));
        cursor = result.LastEvaluatedKey;
        if (rows.length > 1000 || (rows.length === 1000 && cursor))
          throw new Error(
            "Lab dataset limit reached. Add paginated access patterns before expanding beyond 1,000 records per entity type.",
          );
      } while (cursor);
      return rows;
    },
    async page<T>(kind: string, cursor = "", limit = 100, descending = false) {
      const result = await getAwsClients().db.send(
        new QueryCommand({
          TableName: table,
          KeyConditionExpression: "PK = :kind",
          ExpressionAttributeValues: { ":kind": kind },
          ConsistentRead: true,
          Limit: Math.max(1, Math.min(limit, 200)),
          ScanIndexForward: !descending,
          ...(cursor ? { ExclusiveStartKey: { PK: kind, SK: cursor } } : {}),
        }),
      );
      return {
        rows: (result.Items ?? []).map((item) => decode<T>(item)),
        cursor: result.LastEvaluatedKey ? String(result.LastEvaluatedKey["SK"]) : "",
      };
    },
    async transaction(changes) {
      validateChanges(changes);
      try {
        await getAwsClients().db.send(
          new TransactWriteCommand({
            TransactItems: changes.map((change) => {
              const condition = {
                ConditionExpression:
                  change.expected === null ? "attribute_not_exists(PK)" : "#rev = :rev",
                ...(change.expected === null
                  ? {}
                  : {
                      ExpressionAttributeNames: { "#rev": "rev" },
                      ExpressionAttributeValues: { ":rev": change.expected },
                    }),
              };
              if (change.value === null)
                return {
                  Delete: {
                    TableName: table,
                    Key: { PK: change.kind, SK: change.id },
                    ...condition,
                  },
                };
              const expiration =
                typeof change.value === "object" &&
                change.value !== null &&
                "expiresAt" in change.value &&
                typeof change.value.expiresAt === "number"
                  ? Math.floor(change.value.expiresAt / 1000)
                  : undefined;
              return {
                Put: {
                  TableName: table,
                  Item: {
                    PK: change.kind,
                    SK: change.id,
                    rev: (change.expected ?? 0) + 1,
                    value: change.value,
                    ...(expiration ? { expiresAt: expiration } : {}),
                  },
                  ...condition,
                },
              };
            }),
          }),
        );
      } catch (error) {
        if (
          error instanceof Error &&
          error.name === "TransactionCanceledException" &&
          "CancellationReasons" in error
        ) {
          const reasons = error.CancellationReasons as { Code?: string }[] | undefined;
          if (reasons?.some((reason) => reason.Code === "ConditionalCheckFailed"))
            throw new ConflictError();
        }
        throw error;
      }
    },
  };
}

let records: Records | undefined;
let identity = "";
export function getRecords(): Records {
  const config = getRuntimeConfig();
  const current = `${config.mode}:${config.mode === "cloud" ? config.table : config.dataFile}`;
  if (!records || identity !== current) {
    identity = current;
    records =
      config.mode === "cloud"
        ? createDynamoRecords()
        : createFileRecords(config.dataFile, async () => {
            // Import existing catalogue edits without modifying the legacy file.
            const catalogue = await createDemoCatalogueStore(config.demoDataFile).snapshot();
            const rows: Row[] = [];
            const add = (kind: string, id: string, value: unknown) =>
              rows.push({ kind, id, rev: 1, value });
            catalogue.products.forEach((product) => add("PRODUCT", product.id, product));
            catalogue.categories.forEach((category) => add("CATEGORY", category.id, category));
            catalogue.reviews.forEach((review) =>
              add("REVIEW", review.id, { ...review, status: "approved" }),
            );
            catalogue.audit.forEach((entry) =>
              add("AUDIT", `${entry.at}#${entry.id}`, { ...entry, target: entry.productId }),
            );
            orders.forEach((order) =>
              add("ORDER", order.id, {
                ...order,
                version: 1,
                customerEmail: demoUser.email,
                inventoryReleased: true,
              }),
            );
            add("PROFILE", demoUser.id, { ...demoUser, isAdmin: false });
            return rows;
          });
  }
  return records;
}

export function change<T>(
  kind: string,
  id: string,
  row: Row<T> | null,
  value: unknown | null,
): Change {
  return { kind, id, expected: row?.rev ?? null, value };
}
export function auditChange(actor: string, action: string, target: string): Change {
  const id = `${new Date().toISOString()}#${randomUUID()}`;
  return {
    kind: "AUDIT",
    id,
    expected: null,
    value: { id, at: new Date().toISOString(), actor, action, target, productId: target },
  };
}
export async function retryConflict<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof ConflictError) || attempt >= 3) throw error;
    }
  }
}
