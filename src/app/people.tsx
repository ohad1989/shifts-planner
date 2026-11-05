import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { WEEKDAY_LABELS, weekdayName } from '@/domain/dates';
import { DEFAULT_PRIORITY, priorityOf } from '@/domain/eligibility';
import type { Person, RestaurantId, Store, WeekdayLimit } from '@/domain/types';
import { useApp } from '@/ui/AppState';
import { confirmAsync, notify } from '@/ui/dialogs';
import { useI18n } from '@/ui/i18n';
import { Button, Card, Check, Chip, Choice, Field, H, Input, Pill, Row, Spacer, T } from '@/ui/kit';
import { useTheme } from '@/ui/theme';

const LIMITS: [WeekdayLimit, string][] = [
  ['any', 'Any'],
  ['morning', 'Mornings only'],
  ['evening', 'Evenings only'],
  ['off', 'Off'],
];

const PRIORITY_LABELS: Record<number, string> = {
  1: '1 · first choice',
  2: '2 · high',
  3: '3 · normal',
  4: '4 · low',
  5: '5 · last choice',
};

function newPerson(store: Store): Person {
  return {
    id: `p-${Date.now().toString(36)}`,
    name: '',
    homeRestaurantId: 'a',
    roles: [],
    canCoverOther: false,
    active: true,
    noDoubles: store.settings.defaultNoDoubles,
    maxDaysPerWeek: null,
    maxHoursPerWeek: null,
    maxConsecutiveDays: null,
    weekdayLimits: { '0': 'any', '1': 'any', '2': 'any', '3': 'any', '4': 'any', '5': 'any', '6': 'any' },
    unavailableDates: [],
    notes: '',
    priority: DEFAULT_PRIORITY,
  };
}

function summary(p: Person, t: (k: string, v?: Record<string, string | number>) => string): string {
  const bits: string[] = [];
  const lim = Object.values(p.weekdayLimits);
  if (lim.every((l) => l === 'morning' || l === 'off') && lim.includes('morning')) bits.push(t('mornings'));
  else if (lim.every((l) => l === 'evening' || l === 'off') && lim.includes('evening')) bits.push(t('evenings'));
  const offs = Object.entries(p.weekdayLimits)
    .filter(([, l]) => l === 'off')
    .map(([d]) => weekdayName(Number(d)));
  if (offs.length) bits.push(t('off {days}', { days: offs.join('/') }));
  if (p.maxDaysPerWeek != null) bits.push(t('max {n}d', { n: p.maxDaysPerWeek }));
  if (!p.noDoubles) bits.push(t('doubles ok'));
  return bits.join(' · ');
}

const numOrNull = (v: string): number | null => {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default function People() {
  const { s, store, rName } = useApp();
  // Coming from a seat in the planner: /people?id=<person>.
  const { id: requestedId, at } = useLocalSearchParams<{ id?: string; at?: string }>();
  const request = requestedId ? `${requestedId}@${at ?? ''}` : undefined;
  const theme = useTheme();
  const { t, role } = useI18n();
  const wide = useWindowDimensions().width >= 820;
  const [draft, setDraft] = useState<Person | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [q, setQ] = useState('');
  const [newDate, setNewDate] = useState('');

  const saved = draft ? store.people.find((p) => p.id === draft.id) : undefined;
  const dirty = draft != null && (isNew || JSON.stringify(draft) !== JSON.stringify(saved));

  const open = (p: Person) => {
    setDraft({ ...p, weekdayLimits: { ...p.weekdayLimits }, unavailableDates: [...p.unavailableDates] });
    setIsNew(false);
    setNewDate('');
  };

  const leaveDraft = async () =>
    !dirty || (await confirmAsync(t('Discard unsaved changes to this person?'), t('Discard'), t('Cancel')));

  const [openedFor, setOpenedFor] = useState<string | undefined>(undefined);
  if (request && request !== openedFor) {
    setOpenedFor(request);
    const p = store.people.find((x) => x.id === requestedId);
    if (p) open(p);
  }

  const select = async (p: Person) => {
    if (await leaveDraft()) open(p);
  };

  const add = async () => {
    if (!(await leaveDraft())) return;
    setDraft(newPerson(store));
    setIsNew(true);
  };

  const close = async () => {
    if (!(await leaveDraft())) return;
    setDraft(null);
    setIsNew(false);
  };

  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return notify(t('Name is required.'));
    if (draft.roles.length === 0) return notify(t('Pick at least one role.'));
    const clean = { ...draft, name: draft.name.trim() };
    const people = isNew ? [...store.people, clean] : store.people.map((p) => (p.id === clean.id ? clean : p));
    s.savePeople(people);
    setDraft(clean);
    setIsNew(false);
  };

  const remove = async () => {
    if (!draft) return;
    if (isNew) {
      setDraft(null);
      setIsNew(false);
      return;
    }
    const used = Object.values(store.weeks.weeks).some((w) => w.assignments.some((a) => a.personId === draft.id));
    const msg = used
      ? t('Delete {name}? They will be unassigned from every week. (Tip: marking them inactive keeps history.)', {
          name: draft.name,
        })
      : t('Delete {name}?', { name: draft.name });
    if (!(await confirmAsync(msg, t('Delete'), t('Cancel')))) return;
    s.savePeople(store.people.filter((p) => p.id !== draft.id));
    if (used) {
      const weeks = Object.fromEntries(
        Object.entries(store.weeks.weeks).map(([k, w]) => [
          k,
          {
            ...w,
            assignments: w.assignments.map((a) =>
              a.personId === draft.id
                ? { ...a, personId: null, override: false, overrideReason: '', customStart: undefined, customEnd: undefined }
                : a,
            ),
          },
        ]),
      );
      s.saveAllWeeks(weeks);
    }
    setDraft(null);
  };

  const set = <K extends keyof Person>(k: K, v: Person[K]) => draft && setDraft({ ...draft, [k]: v });

  const list = store.people
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
    .sort(
      (a, b) =>
        a.homeRestaurantId.localeCompare(b.homeRestaurantId) ||
        Number(b.active) - Number(a.active) ||
        a.name.localeCompare(b.name),
    );

  const listPane = (
    <View style={{ gap: 10 }}>
      <Row>
        <Input onChangeText={setQ} placeholder={t('Search staff…')} style={{ flex: 1, minWidth: 0 }} value={q} />
        <Button label={t('+ Add')} onPress={() => void add()} variant="primary" />
      </Row>
      {store.people.length === 0 && <T muted>{t('Select a person or add a new one.')}</T>}
      {(['a', 'b'] as RestaurantId[]).map((r) => {
        const group = list.filter((p) => p.homeRestaurantId === r);
        if (!group.length) return null;
        return (
          <View key={r} style={{ gap: 6 }}>
            <T bold muted small>
              {rName(r)} · {t('{n} active', { n: group.filter((p) => p.active).length })}
            </T>
            {group.map((p) => {
              const active = draft?.id === p.id;
              const sum = summary(p, t);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  key={p.id}
                  onPress={() => void select(p)}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      borderColor: active ? theme.accent : theme.border,
                      backgroundColor: active ? theme.accentSoft : theme.surface,
                    },
                    !p.active && { opacity: 0.55 },
                    pressed && { opacity: 0.7 },
                  ]}>
                  <Row gap={6} wrap>
                    <T bold>{p.name}</T>
                    <Pill label={`P${priorityOf(p)}`} tone={priorityOf(p) <= 2 ? 'accent' : 'muted'} />
                    {p.canCoverOther && <Pill label={t('Cover')} tone="cover" />}
                  </Row>
                  <T muted small>
                    {p.roles.map(role).join(', ')}
                    {sum && ` · ${sum}`}
                  </T>
                </Pressable>
              );
            })}
          </View>
        );
      })}
    </View>
  );

  const editor = draft && (
    <Card>
      <Row wrap>
        {!wide && <Button label={`‹ ${t('People')}`} onPress={() => void close()} small variant="link" />}
        <H>{isNew ? t('New person') : draft.name || t('Unnamed')}</H>
        <Spacer />
        <Button label={isNew ? t('Cancel') : t('Delete')} onPress={() => void remove()} small variant="danger" />
        <Button disabled={!dirty} label={t('Save')} onPress={save} small variant="primary" />
      </Row>

      <Field label={t('Full name')}>
        <Input onChangeText={(v) => set('name', v)} value={draft.name} />
      </Field>

      <Field label={t('Home restaurant')}>
        <Choice
          onChange={(v) => set('homeRestaurantId', v)}
          options={store.settings.restaurants.map((r) => [r.id, r.name] as const)}
          value={draft.homeRestaurantId}
        />
      </Field>

      <Field
        hint={t(
          'Arrange gives shifts to higher-priority workers first (1 = first choice), up to their max days. Home staff still come before cover staff, and people under their hour cap before those over it.',
        )}
        label={t('Priority')}>
        <Choice
          onChange={(v) => set('priority', v)}
          options={[1, 2, 3, 4, 5].map((n) => [n, t(PRIORITY_LABELS[n])] as const)}
          value={priorityOf(draft)}
        />
      </Field>

      <Field label={t('Roles')}>
        <Row gap={6} wrap>
          {store.settings.roles.map((r) => {
            const on = draft.roles.includes(r);
            return (
              <Chip
                key={r}
                label={role(r)}
                on={on}
                onPress={() => set('roles', on ? draft.roles.filter((x) => x !== r) : [...draft.roles, r])}
              />
            );
          })}
        </Row>
      </Field>

      <View>
        <Check label={t('Active')} onChange={(v) => set('active', v)} value={draft.active} />
        <Check
          label={t('Can cover {name}', { name: rName(draft.homeRestaurantId === 'a' ? 'b' : 'a') })}
          onChange={(v) => set('canCoverOther', v)}
          value={draft.canCoverOther}
        />
        <Check
          label={t('No double shifts (morning + evening same day)')}
          onChange={(v) => set('noDoubles', v)}
          value={draft.noDoubles}
        />
      </View>

      <Row gap={10} wrap style={{ alignItems: 'flex-start' }}>
        <Field label={t('Max working days / week')} style={styles.num}>
          <Input
            inputMode="numeric"
            onChangeText={(v) => set('maxDaysPerWeek', numOrNull(v))}
            placeholder={t('No cap')}
            value={draft.maxDaysPerWeek?.toString() ?? ''}
          />
        </Field>
        <Field label={t('Max consecutive days')} style={styles.num}>
          <Input
            inputMode="numeric"
            onChangeText={(v) => set('maxConsecutiveDays', numOrNull(v))}
            placeholder={t('No cap')}
            value={draft.maxConsecutiveDays?.toString() ?? ''}
          />
        </Field>
        <Field label={t('Max hours / week (soft)')} style={styles.num}>
          <Input
            inputMode="numeric"
            onChangeText={(v) => set('maxHoursPerWeek', numOrNull(v))}
            placeholder={t('Default {n}', { n: store.settings.hourCap })}
            value={draft.maxHoursPerWeek?.toString() ?? ''}
          />
        </Field>
      </Row>

      <Field label={t('Time of day per weekday')}>
        <View style={{ gap: 8 }}>
          {WEEKDAY_LABELS.map((key, i) => {
            const v = draft.weekdayLimits[String(i)] ?? 'any';
            return (
              <Row key={key} wrap>
                <T bold style={{ width: 70 }}>{weekdayName(i)}</T>
                <Choice
                  onChange={(nv) => set('weekdayLimits', { ...draft.weekdayLimits, [String(i)]: nv })}
                  options={LIMITS.map(([val, txt]) => [val, t(txt)] as const)}
                  value={v}
                />
              </Row>
            );
          })}
        </View>
      </Field>

      <Field label={t('One-off unavailable dates')}>
        <Row gap={6} wrap>
          {[...draft.unavailableDates].sort().map((d) => (
            <Chip
              key={d}
              label={d}
              on
              onRemove={() => set('unavailableDates', draft.unavailableDates.filter((x) => x !== d))}
              removeLabel={t('Remove {d}', { d })}
            />
          ))}
        </Row>
        <Row>
          <Input
            inputMode="numeric"
            invalid={newDate !== '' && !isIsoDate(newDate)}
            maxLength={10}
            onChangeText={setNewDate}
            placeholder="YYYY-MM-DD"
            style={{ width: 140 }}
            value={newDate}
          />
          <Button
            disabled={!isIsoDate(newDate) || draft.unavailableDates.includes(newDate)}
            label={t('Add date')}
            onPress={() => {
              set('unavailableDates', [...draft.unavailableDates, newDate]);
              setNewDate('');
            }}
          />
        </Row>
      </Field>

      <Field label={t('Notes')}>
        <Input multiline onChangeText={(v) => set('notes', v)} style={{ minHeight: 64, paddingTop: 10 }} value={draft.notes} />
      </Field>
    </Card>
  );

  if (!wide) {
    return (
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {editor ?? listPane}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.split, { maxWidth: 1240 }]}>
      <ScrollView contentContainerStyle={styles.content} style={{ width: 340, flexGrow: 0 }}>
        {listPane}
      </ScrollView>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
        {editor ?? <T muted>{t('Select a person or add a new one.')}</T>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12 },
  split: { flex: 1, flexDirection: 'row', width: '100%', alignSelf: 'center' },
  item: { borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 },
  num: { width: 170 },
});
