import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { makeBackup, parseBackup } from '@/data/documents';
import { toIsoDate, WEEKDAY_LABELS, weekdayName } from '@/domain/dates';
import type { Lang, Period, RestaurantId, Settings, Templates, Theme } from '@/domain/types';
import { workingDaysOf } from '@/domain/workdays';
import { pickTextFile, saveTextFile } from '@/export/share';
import { useApp } from '@/ui/AppState';
import { confirmAsync, notify } from '@/ui/dialogs';
import { useI18n } from '@/ui/i18n';
import { Button, Card, Check, Chip, Choice, Field, H, Input, Row, Spacer, T, TimeInput } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { WorkingDays } from '@/ui/WorkingDays';

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export default function SettingsScreen() {
  const { s, store } = useApp();
  const theme = useTheme();
  const { t, role, period: periodName } = useI18n();
  const [settings, setSettings] = useState<Settings>(() => clone(store.settings));
  const [templates, setTemplates] = useState<Templates>(() => clone(store.templates));
  const [newRole, setNewRole] = useState('');

  // Language and theme save immediately (they're also in the header), so
  // they never count as unsaved changes and Save never overwrites them.
  const withPrefs = (x: Settings): Settings => ({
    ...x,
    language: store.settings.language,
    theme: store.settings.theme,
  });
  const dirty =
    JSON.stringify(withPrefs(settings)) !== JSON.stringify(store.settings) ||
    JSON.stringify(templates) !== JSON.stringify(store.templates);

  const save = () => {
    s.saveSettings(withPrefs(settings));
    s.saveTemplates(templates);
  };
  const discard = () => {
    setSettings(clone(store.settings));
    setTemplates(clone(store.templates));
  };
  const setPref = (patch: { language?: Lang; theme?: Theme }) => s.saveSettings({ ...store.settings, ...patch });

  const setTpl = (r: RestaurantId, period: Period, patch: Partial<Templates['templates']['a']['morning']>) =>
    setTemplates((x) => ({
      templates: { ...x.templates, [r]: { ...x.templates[r], [period]: { ...x.templates[r][period], ...patch } } },
    }));

  const seatCount = (r: RestaurantId, period: Period, roleId: string) =>
    templates.templates[r][period].seats.find((x) => x.role === roleId)?.count ?? 0;

  const setSeat = (r: RestaurantId, period: Period, roleId: string, count: number) => {
    const seats = settings.roles
      .map((ro) => ({ role: ro, count: ro === roleId ? count : seatCount(r, period, ro) }))
      .filter((x) => x.count > 0);
    setTpl(r, period, { seats });
  };

  const addRole = () => {
    const id = newRole.trim().toLowerCase();
    if (!id || settings.roles.includes(id)) return;
    setSettings({ ...settings, roles: [...settings.roles, id] });
    setNewRole('');
  };

  const removeRole = (roleId: string) => {
    const holders = store.people.filter((p) => p.roles.includes(roleId)).length;
    if (holders > 0) {
      notify(t('{n} people have the {role} role. Remove it from them first.', { n: holders, role: role(roleId) }));
      return;
    }
    setSettings({ ...settings, roles: settings.roles.filter((r) => r !== roleId) });
    for (const r of ['a', 'b'] as RestaurantId[])
      for (const p of ['morning', 'evening'] as Period[])
        setTpl(r, p, { seats: templates.templates[r][p].seats.filter((x) => x.role !== roleId) });
  };

  const exportBackup = async () => {
    const docs = s.snapshot();
    if (!docs) return;
    try {
      await saveTextFile(
        `shift-planner-${toIsoDate(new Date())}.backup.json`,
        JSON.stringify(makeBackup(docs), null, 2),
        'application/json',
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    }
  };

  const importBackup = async () => {
    try {
      const text = await pickTextFile();
      if (text === null) return;
      const docs = parseBackup(text);
      const ok = await confirmAsync(
        t('Replace all data on this device with the backup ({n} people, {w} weeks)?', {
          n: docs.people.people.length,
          w: Object.keys(docs.weeks.weeks).length,
        }),
        t('Replace'),
        t('Cancel'),
      );
      if (!ok) return;
      await s.replaceAll(docs);
      setSettings(clone(docs.settings));
      setTemplates(clone(docs.templates));
      notify(t('Backup restored.'));
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.bar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Row style={styles.inner} wrap>
          <T muted small style={{ flexShrink: 1, flexBasis: 280, flexGrow: 1 }}>
            {t(
              'Staffing and working-day changes apply to weeks you haven\'t touched yet. Weeks already saved keep their seats — use “Edit seats” or “Working days” in the planner for those.',
            )}
          </T>
          <Button disabled={!dirty} label={t('Discard')} onPress={discard} />
          <Button disabled={!dirty} label={t('Save settings')} onPress={save} variant="primary" />
        </Row>
      </View>
      <ScrollView contentContainerStyle={[styles.content, styles.inner]} keyboardShouldPersistTaps="handled">
        <Card>
          <H>{t('Appearance')}</H>
          <T muted small>{t('These apply right away.')}</T>
          <Field label={t('Language')}>
            <Choice
              onChange={(v) => setPref({ language: v })}
              options={[
                ['en', 'English'],
                ['he', 'עברית'],
              ] as const}
              value={store.settings.language ?? 'en'}
            />
          </Field>
          <Field label={t('Theme')}>
            <Choice
              onChange={(v) => setPref({ theme: v })}
              options={(['system', 'light', 'dark'] as Theme[]).map((m) => [m, t(`theme.${m}`)] as const)}
              value={store.settings.theme ?? 'system'}
            />
          </Field>
        </Card>

        <Card>
          <H>{t('General')}</H>
          {settings.restaurants.map((r, i) => (
            <Field key={r.id} label={t('Restaurant {id} name', { id: r.id.toUpperCase() })}>
              <Input
                onChangeText={(v) => {
                  const restaurants = [...settings.restaurants];
                  restaurants[i] = { ...r, name: v };
                  setSettings({ ...settings, restaurants });
                }}
                value={r.name}
              />
            </Field>
          ))}
          <Field label={t('Week starts on')}>
            <Choice
              onChange={(v) => setSettings({ ...settings, weekStartsOn: v })}
              options={WEEKDAY_LABELS.map((_, i) => [i, weekdayName(i)] as const)}
              value={settings.weekStartsOn ?? 0}
            />
          </Field>
          <Field label={t('Default hour cap / week (soft)')}>
            <Input
              inputMode="numeric"
              onChangeText={(v) => setSettings({ ...settings, hourCap: Number(v) || 0 })}
              style={{ width: 120 }}
              value={String(settings.hourCap)}
            />
          </Field>
          <Check
            label={t('New people: no double shifts by default')}
            onChange={(v) => setSettings({ ...settings, defaultNoDoubles: v })}
            value={settings.defaultNoDoubles}
          />
          <Field label={t('PDF / WhatsApp footer (manager contact)')}>
            <Input onChangeText={(v) => setSettings({ ...settings, pdfFooter: v })} value={settings.pdfFooter} />
          </Field>
        </Card>

        <Card>
          <H>{t('Working days')}</H>
          <T muted small>
            {t(
              "The usual week. New weeks start from this; change a single week (a holiday, or when Shabbat ends later) with “Working days” in the Planner. Evening start blank = the restaurant's usual evening time.",
            )}
          </T>
          <WorkingDays
            eveningDefault={templates.templates.a.evening.start}
            onChange={(key, day) => setSettings({ ...settings, workingDays: { ...workingDaysOf(settings), [key]: day } })}
            rows={WEEKDAY_LABELS.map((_, i) => ({
              key: String(i),
              label: weekdayName(i),
              day: workingDaysOf(settings)[String(i)] ?? { mode: 'both' },
            }))}
          />
        </Card>

        <Card>
          <H>{t('Roles')}</H>
          <Row gap={6} wrap>
            {settings.roles.map((r) => (
              <Chip key={r} label={role(r)} on onRemove={() => removeRole(r)} removeLabel={t('Remove {d}', { d: role(r) })} />
            ))}
          </Row>
          <Row>
            <Input
              onChangeText={setNewRole}
              onSubmitEditing={addRole}
              placeholder={t('New role')}
              style={{ flex: 1, maxWidth: 260 }}
              value={newRole}
            />
            <Button disabled={!newRole.trim()} label={t('Add role')} onPress={addRole} />
          </Row>
        </Card>

        {settings.restaurants.map((r) => (
          <Card key={r.id}>
            <H>{t('{name} · shifts and staffing', { name: r.name })}</H>
            {(['morning', 'evening'] as Period[]).map((period) => {
              const tp = templates.templates[r.id][period];
              return (
                <View key={period} style={{ gap: 8, paddingVertical: 6 }}>
                  <Row wrap>
                    <T bold style={{ width: 70 }}>{periodName(period)}</T>
                    <TimeInput onChange={(v) => setTpl(r.id, period, { start: v })} value={tp.start} />
                    <T>–</T>
                    <TimeInput onChange={(v) => setTpl(r.id, period, { end: v })} value={tp.end} />
                  </Row>
                  <Row gap={14} wrap>
                    {settings.roles.map((ro) => {
                      const n = seatCount(r.id, period, ro);
                      return (
                        <Row gap={6} key={ro}>
                          <T>{role(ro)}</T>
                          <Button
                            disabled={n <= 0}
                            label="−"
                            onPress={() => setSeat(r.id, period, ro, n - 1)}
                            small
                          />
                          <T bold style={{ minWidth: 18, textAlign: 'center' }}>{n}</T>
                          <Button disabled={n >= 9} label="+" onPress={() => setSeat(r.id, period, ro, n + 1)} small />
                        </Row>
                      );
                    })}
                  </Row>
                </View>
              );
            })}
          </Card>
        ))}

        <Card>
          <H>{t('Backup')}</H>
          <T muted small>
            {t(
              'All data is stored on this device. Export a backup file to keep a copy or to move the data to another phone, tablet or computer.',
            )}
          </T>
          <Row wrap>
            <Button label={t('Export backup')} onPress={() => void exportBackup()} />
            <Button label={t('Import backup…')} onPress={() => void importBackup()} />
            <Spacer />
          </Row>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  inner: { width: '100%', maxWidth: 1000, alignSelf: 'center' },
  content: { padding: 14, gap: 12 },
});
