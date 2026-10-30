import fs from "node:fs";
import path from "node:path";
import type { DataName, DataStore, SeedFn } from "./types";

/** One JSON file per document in `dir` (the original storage). */
export class JsonFileStore implements DataStore {
  readonly kind = "json";
  private readonly dir: string;
  private readonly seed: SeedFn;

  constructor(dir: string, seed: SeedFn) {
    this.dir = dir;
    this.seed = seed;
  }

  private file(name: DataName): string {
    return path.join(this.dir, `${name}.json`);
  }

  async get(name: DataName): Promise<unknown> {
    const full = this.file(name);
    if (!fs.existsSync(full)) {
      const data = this.seed(name);
      await this.put(name, data);
      return data;
    }
    return JSON.parse(fs.readFileSync(full, "utf8"));
  }

  async put(name: DataName, data: unknown): Promise<void> {
    fs.mkdirSync(this.dir, { recursive: true });
    const full = this.file(name);
    // Write a temp file and rename it so a crash never leaves half a file.
    const tmp = `${full}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    fs.renameSync(tmp, full);
  }

  async close(): Promise<void> {}
}
