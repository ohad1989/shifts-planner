// Reads the planner's four documents in Node, for the scripts in this folder.
//
// Sources, first match wins:
//   1. a backup file given on the command line (exported from Settings → Backup)
//   2. the desktop version's private data/ folder (data/shift-planner.db, or data/*.json)
//   3. the empty starter files in data-example/
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { DOC_NAMES, type Docs } from "../src/data/db";
import { parseBackup } from "../src/data/documents";

const readJson = (file: string): unknown => JSON.parse(fs.readFileSync(file, "utf8"));

export function loadDocs(backupFile?: string): { docs: Docs; source: string } {
  if (backupFile) {
    return { docs: parseBackup(fs.readFileSync(backupFile, "utf8")), source: backupFile };
  }

  const dataDir = path.resolve("data");
  const exampleDir = path.resolve("data-example");
  const dbFile = path.join(dataDir, "shift-planner.db");
  const fromDb = new Map<string, unknown>();
  if (fs.existsSync(dbFile)) {
    const db = new DatabaseSync(dbFile, { readOnly: true });
    for (const row of db.prepare("SELECT name, data FROM documents").all() as { name: string; data: string }[])
      fromDb.set(row.name, JSON.parse(row.data));
    db.close();
  }

  const sources = new Set<string>();
  const docs = Object.fromEntries(
    DOC_NAMES.map((name) => {
      if (fromDb.has(name)) {
        sources.add(dbFile);
        return [name, fromDb.get(name)];
      }
      const legacy = path.join(dataDir, `${name}.json`);
      const file = fs.existsSync(legacy) ? legacy : path.join(exampleDir, `${name}.json`);
      sources.add(path.dirname(file));
      return [name, readJson(file)];
    }),
  ) as Docs;
  return { docs, source: [...sources].map((s) => path.relative(process.cwd(), s)).join(", ") };
}
