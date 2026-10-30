import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { DataName, DataStore, SeedFn } from "./types";

/**
 * Stores each document as a JSON row in a single SQLite file.
 * Interim backend: one row per document keeps the same shapes as the
 * JSON files, so swapping backends needs no data-model change.
 */
export class SqliteStore implements DataStore {
  readonly kind = "sqlite";
  private readonly db: DatabaseSync;
  private readonly seed: SeedFn;

  constructor(file: string, seed: SeedFn) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.seed = seed;
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS documents (
        name       TEXT PRIMARY KEY,
        data       TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
  }

  async get(name: DataName): Promise<unknown> {
    const row = this.db
      .prepare("SELECT data FROM documents WHERE name = ?")
      .get(name) as { data: string } | undefined;
    if (!row) {
      const data = this.seed(name);
      await this.put(name, data);
      return data;
    }
    return JSON.parse(row.data);
  }

  async put(name: DataName, data: unknown): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO documents (name, data, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
      )
      .run(name, JSON.stringify(data), new Date().toISOString());
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
