import { DatabaseSync } from 'node:sqlite';

import { migrate, type Db, type Docs } from './db';
import { getDoc, loadAll, makeBackup, parseBackup, putDoc, restoreAll } from './documents';
import { SEED } from './seed';

// Runs the real SQL against Node's SQLite through the same calls expo-sqlite offers.
function openTestDb(): Db {
  const sqlite = new DatabaseSync(':memory:');
  return {
    execAsync: async (sql: string) => {
      sqlite.exec(sql);
    },
    getFirstAsync: async (sql: string, params: never[] = []) => sqlite.prepare(sql).get(...params) ?? null,
    getAllAsync: async (sql: string, params: never[] = []) => sqlite.prepare(sql).all(...params),
    runAsync: async (sql: string, params: never[] = []) => sqlite.prepare(sql).run(...params),
  } as unknown as Db;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('documents', () => {
  let db: Db;

  beforeEach(async () => {
    db = openTestDb();
    await migrate(db);
  });

  it('migrates repeatedly without error', async () => {
    await migrate(db);
    await migrate(db);
  });

  it('seeds a missing document on first read and stores it', async () => {
    const seed = clone(SEED);
    const settings = await getDoc(db, 'settings', seed);
    expect(settings).toEqual(SEED.settings);
    seed.settings.hourCap = 999;
    expect((await getDoc(db, 'settings', seed)).hourCap).toBe(SEED.settings.hourCap);
  });

  it('replaces a document on put', async () => {
    const people = { people: [{ id: 'p1', name: 'Dana' }] } as Docs['people'];
    await putDoc(db, 'people', people);
    expect(await getDoc(db, 'people', SEED)).toEqual(people);
  });

  it('round-trips a backup', async () => {
    const docs = clone(SEED);
    docs.settings.pdfFooter = 'Call Ohad';
    const text = JSON.stringify(makeBackup(docs));
    await restoreAll(db, parseBackup(text));
    expect(await loadAll(db, SEED)).toEqual(docs);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON');
    expect(() => parseBackup('{"settings":{}}')).toThrow('missing');
    expect(() =>
      parseBackup(JSON.stringify({ ...SEED, people: { people: 'x' } })),
    ).toThrow('people');
  });
});
