import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { Person, Settings, Store, Templates, WeekRecord } from '@/domain/types';

import type { DocName, Docs } from './db';
import { loadAll, putDoc, restoreAll } from './documents';
import { SEED } from './seed';

const toStore = (d: Docs): Store => ({
  settings: d.settings,
  people: d.people.people,
  templates: d.templates,
  weeks: d.weeks,
});

/**
 * The on-device database is the source of truth. This hook mirrors it in
 * memory for rendering and writes every change straight back. Writes to the
 * same document are queued so they land in order.
 */
export function useStore() {
  const db = useSQLiteContext();
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const ref = useRef<Store | null>(null);
  const queues = useRef<Partial<Record<DocName, Promise<void>>>>({});

  const commit = useCallback((next: Store) => {
    ref.current = next;
    setStore(next);
  }, []);

  const [loadCount, setLoadCount] = useState(0);
  const load = useCallback(() => setLoadCount((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    loadAll(db, SEED).then(
      (docs) => {
        if (cancelled) return;
        commit(toStore(docs));
        setError(null);
      },
      (e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [db, commit, loadCount]);

  const write = useCallback(
    <N extends DocName>(name: N, data: Docs[N]) => {
      setPending((n) => n + 1);
      const prev = queues.current[name] ?? Promise.resolve();
      const next = prev
        .then(() => putDoc(db, name, data))
        .then(() => setSavedAt(new Date()))
        .catch((e) => setError(`Could not save ${name}: ${e instanceof Error ? e.message : e}`))
        .finally(() => setPending((n) => n - 1));
      queues.current[name] = next;
    },
    [db],
  );

  const saveSettings = useCallback(
    (settings: Settings) => {
      commit({ ...ref.current!, settings });
      write('settings', settings);
    },
    [commit, write],
  );

  const savePeople = useCallback(
    (people: Person[]) => {
      commit({ ...ref.current!, people });
      write('people', { people });
    },
    [commit, write],
  );

  const saveTemplates = useCallback(
    (templates: Templates) => {
      commit({ ...ref.current!, templates });
      write('templates', templates);
    },
    [commit, write],
  );

  const saveWeek = useCallback(
    (week: WeekRecord) => {
      const cur = ref.current!;
      const weeks = { weeks: { ...cur.weeks.weeks, [week.weekStart]: week } };
      commit({ ...cur, weeks });
      write('weeks', weeks);
    },
    [commit, write],
  );

  const saveAllWeeks = useCallback(
    (weeksMap: Record<string, WeekRecord>) => {
      const weeks = { weeks: weeksMap };
      commit({ ...ref.current!, weeks });
      write('weeks', weeks);
    },
    [commit, write],
  );

  /** Replaces all data (restore from a backup file). */
  const replaceAll = useCallback(
    async (docs: Docs) => {
      await Promise.all(Object.values(queues.current));
      await restoreAll(db, docs);
      commit(toStore(docs));
      setSavedAt(new Date());
    },
    [db, commit],
  );

  const snapshot = useCallback((): Docs | null => {
    const s = ref.current;
    if (!s) return null;
    return { settings: s.settings, people: { people: s.people }, templates: s.templates, weeks: s.weeks };
  }, []);

  return {
    store,
    error,
    clearError: () => setError(null),
    reload: load,
    saving: pending > 0,
    savedAt,
    saveSettings,
    savePeople,
    saveTemplates,
    saveWeek,
    saveAllWeeks,
    replaceAll,
    snapshot,
  };
}

export type StoreApi = ReturnType<typeof useStore>;
