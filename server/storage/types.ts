// The storage contract for the data API. The client only ever sees
// GET/PUT /api/data/<name>.json, so any backend that can read and write
// these four documents can replace another without touching src/.
//
// A future relational backend (e.g. Postgres) can split each document
// into tables internally, as long as get/put keep the same shapes.

export const DATA_NAMES = ["settings", "people", "templates", "weeks"] as const;
export type DataName = (typeof DATA_NAMES)[number];

export function isDataName(name: string): name is DataName {
  return (DATA_NAMES as readonly string[]).includes(name);
}

export interface DataStore {
  readonly kind: string;
  /** Returns the document, creating it from the seed on first read. */
  get(name: DataName): Promise<unknown>;
  /** Replaces the whole document. Must be atomic: all of it or none. */
  put(name: DataName, data: unknown): Promise<void>;
  close(): Promise<void>;
}

/** Supplies the starting content for a document that doesn't exist yet. */
export type SeedFn = (name: DataName) => unknown;
