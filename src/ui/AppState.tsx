import { createContext, use, useMemo, useState, type ReactNode } from 'react';

import type { StoreApi } from '@/data/useStore';
import { addDays, startOfWeek, toIsoDate } from '@/domain/dates';
import type { RestaurantId, Store, WeekRecord } from '@/domain/types';
import { ensureWeek } from '@/domain/week';
import { defaultWeekDays } from '@/domain/workdays';

type AppState = {
  s: StoreApi;
  store: Store;
  week: WeekRecord;
  weekOffset: number;
  setWeekOffset: (fn: (n: number) => number) => void;
  restaurantId: RestaurantId;
  setRestaurantId: (r: RestaurantId) => void;
  rName: (id: RestaurantId) => string;
};

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider(props: { s: StoreApi; store: Store; children: ReactNode }) {
  const { s, store } = props;
  const [restaurantId, setRestaurantId] = useState<RestaurantId>('a');
  const [weekOffset, setOffset] = useState(0);

  const weekStart = useMemo(() => {
    const base = toIsoDate(startOfWeek(new Date(), store.settings.weekStartsOn ?? 0));
    return addDays(base, weekOffset * 7);
  }, [store.settings.weekStartsOn, weekOffset]);

  const week = ensureWeek(
    store.weeks.weeks[weekStart],
    weekStart,
    store.templates,
    defaultWeekDays(weekStart, store.settings),
  );

  const value: AppState = {
    s,
    store,
    week,
    weekOffset,
    setWeekOffset: (fn) => setOffset(fn),
    restaurantId,
    setRestaurantId,
    rName: (id) => store.settings.restaurants.find((r) => r.id === id)?.name ?? id.toUpperCase(),
  };

  return <Ctx value={value}>{props.children}</Ctx>;
}

export function useApp(): AppState {
  const v = use(Ctx);
  if (!v) throw new Error('useApp must be used inside AppStateProvider');
  return v;
}
