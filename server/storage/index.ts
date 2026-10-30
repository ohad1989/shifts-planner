import fs from "node:fs";
import path from "node:path";
import { JsonFileStore } from "./json-file";
import { SqliteStore } from "./sqlite";
import type { DataName, DataStore, SeedFn } from "./types";

export * from "./types";

export const STORE_KINDS = ["sqlite", "json"] as const;
export type StoreKind = (typeof STORE_KINDS)[number];

export interface StoreOptions {
  /** Private data folder (git-ignored). */
  dataDir: string;
  /** Starter documents for a fresh install. */
  exampleDir: string;
}

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf8"));

// To add a backend (e.g. Postgres): implement DataStore and register it here.
const factories: Record<StoreKind, (opts: StoreOptions) => DataStore> = {
  sqlite: ({ dataDir, exampleDir }) => {
    // A missing document is imported from data/<name>.json when one exists
    // (data saved by the JSON backend), otherwise from data-example/.
    const seed: SeedFn = (name: DataName) => {
      const legacy = path.join(dataDir, `${name}.json`);
      return readJson(fs.existsSync(legacy) ? legacy : path.join(exampleDir, `${name}.json`));
    };
    return new SqliteStore(path.join(dataDir, "shift-planner.db"), seed);
  },
  json: ({ dataDir, exampleDir }) =>
    new JsonFileStore(dataDir, (name) => readJson(path.join(exampleDir, `${name}.json`))),
};

function isStoreKind(kind: string): kind is StoreKind {
  return (STORE_KINDS as readonly string[]).includes(kind);
}

/** Picks the backend from `kind`, else the DATA_STORE env var, else SQLite. */
export function createStore(opts: StoreOptions, kind = process.env.DATA_STORE || "sqlite"): DataStore {
  if (!isStoreKind(kind)) {
    throw new Error(`Unknown DATA_STORE "${kind}". Use one of: ${STORE_KINDS.join(", ")}`);
  }
  return factories[kind](opts);
}
