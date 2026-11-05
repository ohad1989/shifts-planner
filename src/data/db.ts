import type { SQLiteDatabase } from 'expo-sqlite';

import type { PeopleFile, Settings, Templates, WeeksFile } from '@/domain/types';

export type Db = Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'>;

export const DATABASE_NAME = 'shift-planner.db';

/**
 * The app's data is four JSON documents, each stored as one row. Keeping the
 * same shapes as the original data/<name>.json files means a backup file can
 * move data between devices and the desktop version without conversion.
 */
export const DOC_NAMES = ['settings', 'people', 'templates', 'weeks'] as const;
export type DocName = (typeof DOC_NAMES)[number];

export type Docs = {
  settings: Settings;
  people: PeopleFile;
  templates: Templates;
  weeks: WeeksFile;
};

export function isDocName(name: string): name is DocName {
  return (DOC_NAMES as readonly string[]).includes(name);
}

// Each entry upgrades the database by one version. Never edit an entry that has shipped.
const MIGRATIONS = [
  `
  CREATE TABLE documents (
    name TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  `,
];

export async function migrate(db: Db): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  for (let version = current; version < MIGRATIONS.length; version++) {
    await db.execAsync(
      `BEGIN; ${MIGRATIONS[version]} PRAGMA user_version = ${version + 1}; COMMIT;`,
    );
  }
}
