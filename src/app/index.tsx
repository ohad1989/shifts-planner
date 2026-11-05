import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { arrangeWeek, slotLabel } from '@/domain/arrange';
import { dayLabel, shortDate, weekDates } from '@/domain/dates';
import { hourWarning } from '@/domain/eligibility';
import { ltr } from '@/domain/i18n';
import type { Assignment, Period, RestaurantId, WorkingDay } from '@/domain/types';
import {
  addSeat,
  assignedOnClosing,
  hasAssignments,
  PERIODS,
  removeSeat,
  setWorkingDay,
  slotsFor,
} from '@/domain/week';
import { assignmentTimes, defaultWeekDays, periodOpen, periodTimes } from '@/domain/workdays';
import { useApp } from '@/ui/AppState';
import { confirmAsync, notify } from '@/ui/dialogs';
import { useI18n } from '@/ui/i18n';
import { Banner, Button, Card, Check, Collapsible, H, Row, Sheet, Spacer, T } from '@/ui/kit';
import { SlotPicker } from '@/ui/SlotPicker';
import { useTheme } from '@/ui/theme';
import { WeekBar } from '@/ui/WeekBar';
import { WorkingDays } from '@/ui/WorkingDays';

type Scope = RestaurantId | 'both';

const HEAD_W = 86;
const MIN_COL_W = 136;
const MAX_WIDTH = 1240;

export default function Planner() {
  const { s, store, week, restaurantId, rName } = useApp();
  const theme = useTheme();
  const { t, lang, role, reason, period: periodName } = useI18n();
  const other: RestaurantId = restaurantId === 'a' ? 'b' : 'a';
  const dates = weekDates(week.weekStart);
  const nameById = new Map(store.people.map((p) => [p.id, p]));
  const locked = week.status[restaurantId] === 'published';
  const anyPublished = week.status.a === 'published' || week.status.b === 'published';
  const days = week.days ?? {};
  const dayOf = (date: string): WorkingDay => days[date] ?? { mode: 'both' };
  const occ = {
    assignments: week.assignments,
    templates: store.templates,
    hourCap: store.settings.hourCap,
    days: week.days,
  };

  // Day columns share the screen's width, and scroll sideways on narrow screens.
  const { width } = useWindowDimensions();
  const COL_W = Math.max(MIN_COL_W, Math.floor((Math.min(width, MAX_WIDTH) - 30 - HEAD_W) / 7));

  const [picking, setPicking] = useState<Assignment | null>(null);
  const [askScope, setAskScope] = useState<Scope | null>(null);
  const [showReport, setShowReport] = useState(true);
  const [addingAt, setAddingAt] = useState<{ date: string; period: Period } | null>(null);
  const [editSeats, setEditSeats] = useState(false);
  const [editDays, setEditDays] = useState(false);

  const changeDay = async (date: string, day: WorkingDay) => {
    const losing = assignedOnClosing(week, date, day);
    if (
      losing.length > 0 &&
      !(await confirmAsync(
        t('{n} assigned seat(s) on {day} will be removed. Continue?', {
          n: losing.length,
          day: `${dayLabel(date)} ${shortDate(date)}`,
        }),
        t('Continue'),
        t('Cancel'),
      ))
    )
      return;
    s.saveWeek(setWorkingDay(week, store.templates, date, day, days));
  };

  const resetDays = async () => {
    const usual = defaultWeekDays(week.weekStart, store.settings);
    const losing = dates.flatMap((d) => assignedOnClosing(week, d, usual[d]));
    if (
      losing.length > 0 &&
      !(await confirmAsync(
        t('{n} assigned seat(s) will be removed. Continue?', { n: losing.length }),
        t('Continue'),
        t('Cancel'),
      ))
    )
      return;
    let next = week;
    for (const d of dates) next = setWorkingDay(next, store.templates, d, usual[d], next.days ?? {});
    s.saveWeek(next);
  };

  const scopeList = (sc: Scope): RestaurantId[] => (sc === 'both' ? ['a', 'b'] : [sc]);
  const scopeName = (sc: Scope) => (sc === 'both' ? t('both restaurants') : rName(sc));

  const runArrange = (scope: Scope, mode: 'fill-open' | 'replace-all') => {
    const { week: next } = arrangeWeek({
      week,
      people: store.people,
      templates: store.templates,
      hourCap: store.settings.hourCap,
      scope,
      mode,
    });
    s.saveWeek(next);
    setAskScope(null);
    setShowReport(true);
  };

  const onArrange = (scope: Scope) => {
    const rs = scopeList(scope);
    const pub = rs.filter((r) => week.status[r] === 'published');
    if (pub.length) {
      notify(
        t('{names} is published for this week. Reopen it as a draft before arranging.', {
          names: pub.map(rName).join(t(' and ')),
        }),
      );
      return;
    }
    if (hasAssignments(week, rs)) setAskScope(scope);
    else runArrange(scope, 'replace-all');
  };

  const reopen = () => s.saveWeek({ ...week, status: { ...week.status, [restaurantId]: 'draft' } });

  const mine = week.assignments.filter((a) => a.restaurantId === restaurantId);
  const filled = mine.filter((a) => a.personId).length;
  const report = week.lastArrangeReport;
  const openLabel = (id: string, fallback: string) => {
    const a = week.assignments.find((x) => x.id === id);
    return a ? slotLabel(a, rName, lang) : fallback;
  };

  const cellBox = { width: COL_W, borderColor: theme.border };
  const headBox = { width: HEAD_W, borderColor: theme.border };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <WeekBar />

      <Row gap={10} wrap>
        <Row gap={6}>
          <T bold size={26}>{filled}</T>
          <T muted size={18}>/{mine.length}</T>
          <T muted>{t('seats filled at {name}', { name: rName(restaurantId) })}</T>
        </Row>
        <Spacer />
        <Button
          disabled={anyPublished}
          label={t('Working days')}
          onPress={() => setEditDays(true)}
        />
        <Check disabled={locked} label={t('Edit seats')} onChange={setEditSeats} value={editSeats} />
        <Button
          disabled={locked}
          label={t('Arrange {name}', { name: rName(restaurantId) })}
          onPress={() => onArrange(restaurantId)}
        />
        <Button label={t('Arrange both restaurants')} onPress={() => onArrange('both')} variant="primary" />
      </Row>
      {anyPublished && (
        <T muted small>{t('Reopen both restaurants as drafts to change working days')}</T>
      )}

      {locked && (
        <Banner
          action={<Button label={t('Reopen as draft')} onPress={reopen} small variant="link" />}
          tone="info">
          {t('This week is published for {name} — the grid is locked.', { name: rName(restaurantId) })}
        </Banner>
      )}

      <ScrollView horizontal style={[styles.gridWrap, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <View>
          {/* day headers */}
          <View style={styles.gridRow}>
            <View style={[styles.cell, headBox]} />
            {dates.map((d) => {
              const day = dayOf(d);
              return (
                <View
                  key={d}
                  style={[styles.cell, cellBox, { backgroundColor: theme.background }, day.mode === 'closed' && { opacity: 0.6 }]}>
                  <T bold>{dayLabel(d)}</T>
                  <T muted small>{shortDate(d)}</T>
                  {day.mode === 'closed' && <T small tone="danger">{t('Closed')}</T>}
                  {day.mode !== 'closed' && day.eveningStart && periodOpen(day, 'evening') && (
                    <T small tone="warn">{t('PM from {time}', { time: ltr(day.eveningStart) })}</T>
                  )}
                </View>
              );
            })}
          </View>

          {PERIODS.map((period) => {
            const pt = periodTimes(store.templates, restaurantId, period);
            return (
              <View key={period} style={styles.gridRow}>
                <View style={[styles.cell, headBox]}>
                  <T bold>{periodName(period)}</T>
                  <T muted small>{ltr(`${pt.start}–${pt.end}`)}</T>
                </View>
                {dates.map((date) => {
                  const slots = slotsFor(week, restaurantId, date, period);
                  if (!periodOpen(dayOf(date), period) && slots.length === 0) {
                    return (
                      <View key={date} style={[styles.cell, cellBox, styles.closed, { backgroundColor: theme.background }]}>
                        <T muted small>{t('Closed')}</T>
                      </View>
                    );
                  }
                  return (
                    <View key={date} style={[styles.cell, cellBox, { gap: 5 }]}>
                      {slots.map((slot) => {
                        const p = slot.personId ? nameById.get(slot.personId) : undefined;
                        const warn = p ? hourWarning(p, slot, occ, slot.id) : null;
                        const times = assignmentTimes(slot, store.templates, week.days);
                        const isCover = !!p && p.homeRestaurantId !== restaurantId;
                        const tone = slot.override
                          ? [theme.overrideSoft, theme.override]
                          : !p
                            ? [theme.openSoft, theme.open]
                            : isCover
                              ? [theme.coverSoft, theme.cover]
                              : [theme.background, theme.text];
                        return (
                          <View key={slot.id} style={styles.seatRow}>
                            <Pressable
                              accessibilityHint={
                                slot.override
                                  ? t('Override: {reason}', { reason: slot.overrideReason })
                                  : warn
                                    ? reason(warn)
                                    : undefined
                              }
                              accessibilityRole="button"
                              disabled={locked}
                              onPress={() => setPicking(slot)}
                              style={({ pressed }) => [
                                styles.seat,
                                { backgroundColor: tone[0], borderColor: !p ? theme.open : theme.border },
                                !p && { borderStyle: 'dashed' },
                                pressed && { opacity: 0.6 },
                              ]}>
                              <Text style={{ color: theme.textMuted, fontSize: 11 }}>{role(slot.role)}</Text>
                              <Row gap={4}>
                                <Text numberOfLines={1} style={{ color: tone[1], fontWeight: '600', fontSize: 14, flexShrink: 1 }}>
                                  {p ? p.name : slot.personId ? t('Unknown') : t('Open')}
                                </Text>
                                {slot.override && <Text style={{ color: theme.override, fontWeight: '800' }}>!</Text>}
                                {!slot.override && warn && <Text style={{ color: theme.warn, fontWeight: '800' }}>h</Text>}
                              </Row>
                              {times.custom && p && (
                                <Text style={{ color: theme.warn, fontSize: 11 }}>{ltr(`${times.start}–${times.end}`)}</Text>
                              )}
                            </Pressable>
                            {editSeats && !locked && (
                              <Pressable
                                accessibilityLabel={t('Remove this seat')}
                                accessibilityRole="button"
                                hitSlop={6}
                                onPress={() => s.saveWeek(removeSeat(week, slot.id))}>
                                <Text style={{ color: theme.danger, fontSize: 18 }}>×</Text>
                              </Pressable>
                            )}
                          </View>
                        );
                      })}
                      {editSeats && !locked && (
                        <Button label={t('+ seat')} onPress={() => setAddingAt({ date, period })} small variant="link" />
                      )}
                    </View>
                  );
                })}
              </View>
            );
          })}

          {/* the other restaurant on the same day */}
          <View style={styles.gridRow}>
            <View style={[styles.cell, headBox, { backgroundColor: theme.background }]}>
              <T bold small>{rName(other)}</T>
              <T muted small>{t('same day')}</T>
            </View>
            {dates.map((date) => (
              <View key={date} style={[styles.cell, cellBox, { backgroundColor: theme.background, gap: 2 }]}>
                {PERIODS.filter((period) => periodOpen(dayOf(date), period)).map((period) => {
                  const sl = slotsFor(week, other, date, period);
                  const f = sl.filter((a) => a.personId).length;
                  const crossers = sl
                    .map((a) => (a.personId ? nameById.get(a.personId) : undefined))
                    .filter((p) => p && p.homeRestaurantId === restaurantId)
                    .map((p) => p!.name.split(' ')[0]);
                  return (
                    <View key={period}>
                      <T small tone={f < sl.length ? 'danger' : 'muted'}>
                        {period === 'morning' ? t('AM') : t('PM')} {f}/{sl.length}
                      </T>
                      {crossers.length > 0 && (
                        <T small style={{ color: theme.cover }}>↗ {crossers.join(', ')}</T>
                      )}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <Row gap={14} wrap>
        <Legend color={theme.open} label={t('Open')} />
        <Legend color={theme.cover} label={t('Cover from other site')} />
        <Legend color={theme.override} label={t('Override')} />
        <T muted small><Text style={{ color: theme.warn, fontWeight: '800' }}>h</Text> {t('Over hour cap')}</T>
        <T muted small><Text style={{ color: theme.warn }}>{ltr('12:00–18:00')}</Text> {t('Custom hours')}</T>
      </Row>

      {report && showReport && (
        <Card>
          <Row wrap>
            <H size={15}>
              {t('Last arrange')} · {scopeName(report.scope)} ·{' '}
              {report.mode === 'replace-all' ? t('replace all') : t('fill open only')}
            </H>
            <T muted small>
              {new Date(report.at).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </T>
            <Spacer />
            <Button label={t('Hide')} onPress={() => setShowReport(false)} small variant="link" />
          </Row>
          <Row gap={18} wrap>
            <T><T bold>{report.filled}</T> {t('filled')}</T>
            <T tone={report.leftOpen ? 'danger' : undefined}><T bold>{report.leftOpen}</T> {t('left open')}</T>
            <T><T bold>{report.atMaxDays.length}</T> {t('at max days')}</T>
          </Row>
          {report.opens && report.opens.length > 0 && (
            <Collapsible initiallyOpen title={t('Why seats stayed open')}>
              {report.opens.map((o) => (
                <View key={o.id} style={{ marginBottom: 6 }}>
                  <T bold>{openLabel(o.id, o.label)}</T>
                  <T muted small>{reason(o.why)}</T>
                </View>
              ))}
            </Collapsible>
          )}
          {report.atMaxDays.length > 0 && (
            <Collapsible title={t('People at their max days')}>
              <T small>{report.atMaxDays.join(', ')}</T>
            </Collapsible>
          )}
          {report.unusedCover && report.unusedCover.length > 0 && (
            <Collapsible title={t('Cover staff not used at the other site')}>
              <T small>{reason(report.unusedCover.join(', '))}</T>
            </Collapsible>
          )}
        </Card>
      )}

      {picking && (
        <SlotPicker
          onClose={() => setPicking(null)}
          onEditPerson={(id) => {
            setPicking(null);
            router.navigate({ pathname: '/people', params: { id, at: String(Date.now()) } });
          }}
          slotId={picking.id}
        />
      )}

      {askScope && (
        <Sheet
          footer={
            <>
              <Button label={t('Replace all')} onPress={() => runArrange(askScope, 'replace-all')} />
              <Button label={t('Fill open only')} onPress={() => runArrange(askScope, 'fill-open')} variant="primary" />
            </>
          }
          onClose={() => setAskScope(null)}
          title={t('This week already has assignments')}>
          <T>
            {t('Arranging')} <T bold>{scopeName(askScope)}</T>.
          </T>
          <T>
            <T bold>{t('Fill open only')}</T>{' '}
            {t('keeps every current assignment, including your edits, and only fills empty seats.')}
          </T>
          <T>
            <T bold>{t('Replace all')}</T>{' '}
            {t(
              "clears this week's assignments at {where} and fills from scratch. Overrides and custom hours are removed too.",
              { where: scopeName(askScope) },
            )}
          </T>
        </Sheet>
      )}

      {editDays && (
        <Sheet
          footer={
            <>
              <Button label={t('Reset to usual week')} onPress={() => void resetDays()} />
              <Button label={t('Done')} onPress={() => setEditDays(false)} variant="primary" />
            </>
          }
          onClose={() => setEditDays(false)}
          title={t('Working days this week')}>
          <T muted small>
            {t(
              'Applies to both restaurants for this week only. Closing a shift removes its seats; opening one adds the usual seats. The usual week is in Settings.',
            )}
          </T>
          <WorkingDays
            eveningDefault={periodTimes(store.templates, restaurantId, 'evening').start}
            onChange={(d, day) => void changeDay(d, day)}
            rows={dates.map((d) => ({ key: d, label: dayLabel(d), sub: shortDate(d), day: dayOf(d) }))}
          />
        </Sheet>
      )}

      {addingAt && (
        <Sheet
          onClose={() => setAddingAt(null)}
          title={t('Add a seat · {day} {period}', {
            day: dayLabel(addingAt.date),
            period: periodName(addingAt.period),
          })}>
          <T muted>{t('Which role is this extra seat for?')}</T>
          <Row wrap>
            {store.settings.roles.map((r) => (
              <Button
                key={r}
                label={role(r)}
                onPress={() => {
                  s.saveWeek(addSeat(week, restaurantId, addingAt.date, addingAt.period, r));
                  setAddingAt(null);
                }}
              />
            ))}
          </Row>
        </Sheet>
      )}
    </ScrollView>
  );
}

function Legend(props: { color: string; label: string }) {
  return (
    <Row gap={6}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: props.color }} />
      <T muted small>{props.label}</T>
    </Row>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  gridWrap: { borderWidth: 1, borderRadius: 12, flexGrow: 0 },
  gridRow: { flexDirection: 'row' },
  cell: { padding: 6, borderEndWidth: 1, borderBottomWidth: 1 },
  closed: { alignItems: 'center', justifyContent: 'center' },
  seatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  seat: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, minHeight: 40 },
});
