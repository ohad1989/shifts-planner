import { DOC_NAMES, type Db, type DocName, type Docs } from './db';

/** Returns the document, creating it from `seed` on first read. */
export async function getDoc<N extends DocName>(db: Db, name: N, seed: Docs): Promise<Docs[N]> {
  const row = await db.getFirstAsync<{ data: string }>(
    'SELECT data FROM documents WHERE name = ?',
    [name],
  );
  if (row) return JSON.parse(row.data) as Docs[N];
  const data = seed[name];
  await putDoc(db, name, data);
  return data;
}

/** Replaces the whole document. A single statement, so it lands all or nothing. */
export async function putDoc<N extends DocName>(db: Db, name: N, data: Docs[N]): Promise<void> {
  await db.runAsync(
    `INSERT INTO documents (name, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    [name, JSON.stringify(data), new Date().toISOString()],
  );
}

export async function loadAll(db: Db, seed: Docs): Promise<Docs> {
  return {
    settings: await getDoc(db, 'settings', seed),
    people: await getDoc(db, 'people', seed),
    templates: await getDoc(db, 'templates', seed),
    weeks: await getDoc(db, 'weeks', seed),
  };
}

// --- backup files -----------------------------------------------------------

export const BACKUP_FORMAT = 'shift-planner-backup';

export type Backup = { format: typeof BACKUP_FORMAT; version: 1; exportedAt: string } & Docs;

export function makeBackup(docs: Docs, now = new Date()): Backup {
  return { format: BACKUP_FORMAT, version: 1, exportedAt: now.toISOString(), ...docs };
}

/**
 * Reads a backup file's text. Throws a readable message when it isn't one.
 * Each document is checked for its basic shape so a wrong file can't wipe data.
 */
export function parseBackup(text: string): Docs {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('The file is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object') throw new Error('The file is not a Shift Planner backup.');
  const r = raw as Record<string, unknown>;
  const missing = DOC_NAMES.filter((n) => !r[n] || typeof r[n] !== 'object');
  if (missing.length) throw new Error(`The backup is missing: ${missing.join(', ')}.`);
  const s = r.settings as Record<string, unknown>;
  const p = r.people as Record<string, unknown>;
  const t = r.templates as Record<string, unknown>;
  const w = r.weeks as Record<string, unknown>;
  if (!Array.isArray(s.restaurants) || !Array.isArray(s.roles))
    throw new Error('The backup settings are not valid.');
  if (!Array.isArray(p.people)) throw new Error('The backup people list is not valid.');
  if (!t.templates || typeof t.templates !== 'object')
    throw new Error('The backup staffing templates are not valid.');
  if (!w.weeks || typeof w.weeks !== 'object') throw new Error('The backup weeks are not valid.');
  return {
    settings: r.settings,
    people: r.people,
    templates: r.templates,
    weeks: r.weeks,
  } as Docs;
}

/** Replaces every document in one transaction. */
export async function restoreAll(db: Db, docs: Docs): Promise<void> {
  await db.execAsync('BEGIN');
  try {
    for (const name of DOC_NAMES) await putDoc(db, name, docs[name]);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}
