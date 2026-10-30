import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";
import type { Person, Settings, Store, Templates, WeekRecord } from "./types";

/**
 * The JSON files on disk are the source of truth. This hook mirrors them in
 * memory for rendering and writes every change straight back to its file.
 * Writes to the same file are queued so they land in order.
 */
export function useStore() {
  const [store, setStore] = useState<Store | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(0);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const ref = useRef<Store | null>(null);
  const queues = useRef<Record<string, Promise<void>>>({});

  const load = useCallback(async () => {
    try {
      const [settings, people, templates, weeks] = await Promise.all([
        api.settings.get(),
        api.people.get(),
        api.templates.get(),
        api.weeks.get(),
      ]);
      const s: Store = { settings, people: people.people, templates, weeks };
      ref.current = s;
      setStore(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const write = useCallback((file: string, fn: () => Promise<void>) => {
    setPending((n) => n + 1);
    const prev = queues.current[file] ?? Promise.resolve();
    const next = prev
      .then(fn)
      .then(() => setSavedAt(new Date()))
      .catch((e) =>
        setError(`Could not save ${file}: ${e instanceof Error ? e.message : e}`),
      )
      .finally(() => setPending((n) => n - 1));
    queues.current[file] = next;
  }, []);

  const commit = useCallback((next: Store) => {
    ref.current = next;
    setStore(next);
  }, []);

  const saveSettings = useCallback(
    (settings: Settings) => {
      const cur = ref.current!;
      commit({ ...cur, settings });
      write("settings.json", () => api.settings.put(settings));
    },
    [commit, write],
  );

  const savePeople = useCallback(
    (people: Person[]) => {
      const cur = ref.current!;
      commit({ ...cur, people });
      write("people.json", () => api.people.put({ people }));
    },
    [commit, write],
  );

  const saveTemplates = useCallback(
    (templates: Templates) => {
      const cur = ref.current!;
      commit({ ...cur, templates });
      write("templates.json", () => api.templates.put(templates));
    },
    [commit, write],
  );

  const saveWeek = useCallback(
    (week: WeekRecord) => {
      const cur = ref.current!;
      const weeks = { weeks: { ...cur.weeks.weeks, [week.weekStart]: week } };
      commit({ ...cur, weeks });
      write("weeks.json", () => api.weeks.put(weeks));
    },
    [commit, write],
  );

  const saveAllWeeks = useCallback(
    (weeksMap: Record<string, WeekRecord>) => {
      const cur = ref.current!;
      const weeks = { weeks: weeksMap };
      commit({ ...cur, weeks });
      write("weeks.json", () => api.weeks.put(weeks));
    },
    [commit, write],
  );

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
  };
}

export type StoreApi = ReturnType<typeof useStore>;
