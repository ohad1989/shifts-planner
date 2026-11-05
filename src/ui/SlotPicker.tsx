import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { slotLabel } from '@/domain/arrange';
import { daysWorked, hourWarning, hoursWorked, ineligibleReasons, priorityOf } from '@/domain/eligibility';
import { ltr } from '@/domain/i18n';
import type { Person } from '@/domain/types';
import { setSlot } from '@/domain/week';
import { assignmentTimes, periodTimes, spanHours } from '@/domain/workdays';

import { useApp } from './AppState';
import { useI18n } from './i18n';
import { Button, Card, Field, H, Input, Pill, Row, Sheet, Spacer, T, TimeInput } from './kit';
import { useTheme } from './theme';

/** Seat dialog: eligible people, ineligible people with reasons, unassign, override, custom hours. */
export function SlotPicker(props: { slotId: string; onClose: () => void; onEditPerson: (id: string) => void }) {
  const { slotId, onClose, onEditPerson } = props;
  const { s, store, week, rName } = useApp();
  const theme = useTheme();
  const { t, lang, reason } = useI18n();
  const slot = week.assignments.find((a) => a.id === slotId);
  const [showAll, setShowAll] = useState(false);
  const [overrideFor, setOverrideFor] = useState<Person | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [filter, setFilter] = useState('');
  const initial = slot ? assignmentTimes(slot, store.templates, week.days) : null;
  const [start, setStart] = useState(initial?.start ?? '');
  const [end, setEnd] = useState(initial?.end ?? '');

  if (!slot || !initial) return null;
  const occ = {
    assignments: week.assignments,
    templates: store.templates,
    hourCap: store.settings.hourCap,
    days: week.days,
  };
  const usual = periodTimes(store.templates, slot.restaurantId, slot.period, week.days?.[slot.date]);
  const current = slot.personId ? store.people.find((p) => p.id === slot.personId) : undefined;
  // Candidates are judged on the shift's usual hours: custom hours belong to whoever holds the seat.
  const plainSlot = { ...slot, customStart: undefined, customEnd: undefined };
  const others = week.assignments.filter((a) => a.id !== slot.id);

  const rows = store.people
    .filter((p) => p.id !== slot.personId)
    .filter((p) => !filter || p.name.toLowerCase().includes(filter.toLowerCase()))
    .map((p) => ({
      p,
      reasons: ineligibleReasons(p, slot, occ, slot.id),
      warn: hourWarning(p, plainSlot, occ, slot.id),
      days: daysWorked(p.id, others).size,
      hours: hoursWorked(p.id, others, store.templates, week.days),
      home: p.homeRestaurantId === slot.restaurantId,
      hasRole: p.roles.includes(slot.role),
    }));

  const eligible = rows
    .filter((r) => r.reasons.length === 0)
    .sort(
      (a, b) =>
        Number(b.home) - Number(a.home) ||
        Number(!!a.warn) - Number(!!b.warn) ||
        priorityOf(a.p) - priorityOf(b.p) ||
        a.days - b.days ||
        a.p.name.localeCompare(b.p.name),
    );
  const blocked = rows
    .filter((r) => r.reasons.length > 0 && r.p.active)
    .filter((r) => showAll || r.hasRole)
    .sort(
      (a, b) =>
        Number(b.hasRole) - Number(a.hasRole) ||
        a.reasons.length - b.reasons.length ||
        a.p.name.localeCompare(b.p.name),
    );
  const hiddenCount = rows.filter((r) => r.reasons.length > 0 && r.p.active && !r.hasRole).length;

  // A new person on the seat starts from the usual hours.
  const assign = (p: Person | null, override = false, why = '') => {
    s.saveWeek(
      setSlot(week, slot.id, {
        personId: p ? p.id : null,
        override,
        overrideReason: override ? why : '',
        customStart: undefined,
        customEnd: undefined,
      }),
    );
    onClose();
  };

  const saveHours = (customStart?: string, customEnd?: string) => {
    s.saveWeek(setSlot(week, slot.id, { customStart, customEnd }));
    onClose();
  };
  const hoursValid = /^\d\d:\d\d$/.test(start) && /^\d\d:\d\d$/.test(end) && start !== end;
  const hoursChanged = start !== initial.start || end !== initial.end;
  const isUsual = start === usual.start && end === usual.end;
  const weekHours = current
    ? hoursWorked(current.id, others, store.templates, week.days) + (hoursValid ? spanHours(start, end) : 0)
    : 0;
  const capDays = (p: Person) => (p.maxDaysPerWeek == null ? '' : `/${p.maxDaysPerWeek}`);

  const rowStyle = {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 10,
    gap: 4,
  } as const;

  return (
    <Sheet onClose={onClose} title={slotLabel(slot, rName, lang)} wide>
      {overrideFor ? (
        <View style={{ gap: 12 }}>
          <T>{t('Assign {name} anyway? This breaks:', { name: overrideFor.name })}</T>
          {ineligibleReasons(overrideFor, slot, occ, slot.id).map((r) => (
            <T key={r} tone="danger">• {reason(r)}</T>
          ))}
          <Field label={t('Reason (shown on the publish checklist)')}>
            <Input
              autoFocus
              onChangeText={setOverrideReason}
              placeholder={t('e.g. Agreed by phone, swap with Dani')}
              value={overrideReason}
            />
          </Field>
          <Row>
            <Spacer />
            <Button label={t('Back')} onPress={() => setOverrideFor(null)} />
            <Button
              disabled={!overrideReason.trim()}
              label={t('Confirm override')}
              onPress={() => assign(overrideFor, true, overrideReason.trim())}
              variant="danger"
            />
          </Row>
        </View>
      ) : (
        <>
          <Row wrap>
            <View style={{ flexShrink: 1, gap: 2 }}>
              <T muted small>{t('Currently')}</T>
              <Row wrap>
                <H>{current ? current.name : slot.personId ? t('Unknown person') : t('Open')}</H>
                {slot.override && (
                  <Pill label={t('Override: {reason}', { reason: slot.overrideReason })} tone="override" />
                )}
              </Row>
            </View>
            <Spacer />
            {current && <Button label={t('Edit worker')} onPress={() => onEditPerson(current.id)} small />}
            {slot.personId && <Button label={t('Unassign')} onPress={() => assign(null)} small />}
          </Row>

          {current && (
            <Card style={{ backgroundColor: theme.background }}>
              <Row wrap>
                <T bold>{t('Hours for {name}', { name: current.name })}</T>
                <T muted small>{t('Usual shift {time}', { time: ltr(`${usual.start}–${usual.end}`) })}</T>
              </Row>
              <Row gap={10} wrap>
                <Field label={t('Start')}>
                  <TimeInput accessibilityLabel={t('Start')} onChange={setStart} value={start} />
                </Field>
                <Field label={t('End')}>
                  <TimeInput accessibilityLabel={t('End')} onChange={setEnd} value={end} />
                </Field>
                <View>
                  <T><T bold>{hoursValid ? spanHours(start, end) : '—'}</T> {t('h this shift')}</T>
                  <T muted small>{t('{h}h this week', { h: Math.round(weekHours * 100) / 100 })}</T>
                </View>
                <Spacer />
                {initial.custom && (
                  <Button label={t('Back to usual hours')} onPress={() => saveHours(undefined, undefined)} small variant="link" />
                )}
                <Button
                  disabled={!hoursValid || !hoursChanged}
                  label={t('Save hours')}
                  onPress={() => (isUsual ? saveHours(undefined, undefined) : saveHours(start, end))}
                  small
                  variant="primary"
                />
              </Row>
            </Card>
          )}

          <Input onChangeText={setFilter} placeholder={t('Filter by name…')} value={filter} />

          <H size={15}>{t('Eligible ({n})', { n: eligible.length })}</H>
          {eligible.length === 0 && <T muted small>{t('Nobody can take this seat without breaking a rule.')}</T>}
          {eligible.map((r) => (
            <Pressable
              accessibilityRole="button"
              key={r.p.id}
              onPress={() => assign(r.p)}
              style={({ pressed }) => [rowStyle, { backgroundColor: theme.surface }, pressed && { opacity: 0.6 }]}>
              <Row wrap>
                <T bold>{r.p.name}</T>
                <Pill label={`P${priorityOf(r.p)}`} tone={priorityOf(r.p) <= 2 ? 'accent' : 'muted'} />
                {!r.home && <Pill label={t('Cover')} tone="cover" />}
                {r.warn && <Pill label={reason(r.warn)} tone="warn" />}
                <Spacer />
                <T muted small>{t('{days} days · {hours}h', { days: `${r.days}${capDays(r.p)}`, hours: r.hours })}</T>
              </Row>
            </Pressable>
          ))}

          <H size={15}>{t('Not eligible ({n})', { n: blocked.length })}</H>
          {blocked.map((r) => (
            <View key={r.p.id} style={[rowStyle, { backgroundColor: theme.background }]}>
              <Row wrap>
                <T bold muted>{r.p.name}</T>
                <Spacer />
                <Button
                  label={t('Override…')}
                  onPress={() => {
                    setOverrideReason('');
                    setOverrideFor(r.p);
                  }}
                  small
                  variant="link"
                />
              </Row>
              <T small tone="danger">{r.reasons.map(reason).join(' · ')}</T>
            </View>
          ))}
          {hiddenCount > 0 && (
            <Button
              label={
                showAll
                  ? t('Hide {n} people without this role', { n: hiddenCount })
                  : t('Show {n} people without this role', { n: hiddenCount })
              }
              onPress={() => setShowAll((v) => !v)}
              variant="link"
            />
          )}
        </>
      )}
    </Sheet>
  );
}
