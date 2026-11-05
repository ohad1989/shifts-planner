import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { publishChecklist } from '@/domain/checks';
import { weekTableCsv } from '@/domain/table';
import { weekSummaryText } from '@/domain/whatsapp';
import { downloadWeekPdf } from '@/export/pdf';
import { copyText, saveTextFile } from '@/export/share';
import { useApp } from '@/ui/AppState';
import { confirmAsync, notify } from '@/ui/dialogs';
import { useI18n } from '@/ui/i18n';
import { Button, Card, Collapsible, H, Row, Spacer, T } from '@/ui/kit';
import { useTheme } from '@/ui/theme';
import { WeekBar } from '@/ui/WeekBar';

export default function Publish() {
  const { s, store, week, restaurantId, rName } = useApp();
  const theme = useTheme();
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = week.status[restaurantId];
  const snapshot = week.published?.[restaurantId];
  const check = publishChecklist({
    week,
    restaurantId,
    people: store.people,
    templates: store.templates,
    settings: store.settings,
    lang,
  });
  const exportOpts = {
    week,
    restaurantId,
    settings: store.settings,
    people: store.people,
    templates: store.templates,
    lang,
  };
  const text = weekSummaryText(exportOpts);
  const fileBase = `${rName(restaurantId).replace(/\s+/g, '-')}-${week.weekStart}`;

  const publish = async () => {
    if (
      check.conflicts.length &&
      !(await confirmAsync(
        t('There are {n} conflicts. Publish anyway?', { n: check.conflicts.length }),
        t('Publish'),
        t('Cancel'),
      ))
    )
      return;
    s.saveWeek({
      ...week,
      status: { ...week.status, [restaurantId]: 'published' },
      published: {
        ...(week.published ?? {}),
        [restaurantId]: {
          at: new Date().toISOString(),
          assignments: week.assignments.filter((a) => a.restaurantId === restaurantId),
        },
      },
    });
  };
  const reopen = () => s.saveWeek({ ...week, status: { ...week.status, [restaurantId]: 'draft' } });

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const sections: [string, string[], 'danger' | 'warn' | 'accent'][] = [
    [t('Conflicts'), check.conflicts, 'danger'],
    [t('Open seats'), check.open, 'warn'],
    [t('Overrides'), check.overrides, 'accent'],
    [t('Hour warnings'), check.hourWarnings, 'warn'],
  ];

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <WeekBar />

      <Card>
        <Row wrap>
          <H>{t('Checklist · {name}', { name: rName(restaurantId) })}</H>
          <Spacer />
          {status === 'published' ? (
            <>
              <T muted small>
                {t('Published {when}', {
                  when: snapshot ? new Date(snapshot.at).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB') : '',
                })}
              </T>
              <Button label={t('Reopen as draft')} onPress={reopen} />
            </>
          ) : (
            <Button label={snapshot ? t('Republish') : t('Publish')} onPress={() => void publish()} variant="primary" />
          )}
        </Row>
        {sections.map(([title, items, tone]) => (
          <Collapsible
            initiallyOpen={items.length > 0 && items.length <= 8}
            key={title}
            title={
              <Row gap={8}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: items.length
                      ? { danger: theme.danger, warn: theme.warn, accent: theme.override }[tone]
                      : theme.good,
                  }}
                />
                <T bold>{title}</T>
                <T bold muted>{items.length}</T>
              </Row>
            }>
            {items.map((i) => (
              <T key={i} small>• {i}</T>
            ))}
          </Collapsible>
        ))}
      </Card>

      <Card>
        <Row wrap>
          <H>{t('Share')}</H>
          <Spacer />
          <Button disabled={busy} label={t('Download PDF')} onPress={() => void run(() => downloadWeekPdf(exportOpts))} />
          <Button
            accessibilityLabel={t("A table with the week's roster and hours per worker. Opens in Excel.")}
            disabled={busy}
            label={t('Download table (Excel)')}
            onPress={() =>
              void run(() =>
                saveTextFile(`${fileBase}.csv`, '﻿' + weekTableCsv(exportOpts), 'text/csv;charset=utf-8'),
              )
            }
          />
          <Button
            label={copied ? t('Copied ✓') : t('Copy WhatsApp text')}
            onPress={async () => {
              const ok = await copyText(text);
              setCopied(ok);
              if (ok) setTimeout(() => setCopied(false), 2000);
            }}
            variant="primary"
          />
        </Row>
        {status !== 'published' && (
          <T muted small>{t('This week is still a draft — the PDF will be marked DRAFT.')}</T>
        )}
        {lang === 'he' && process.env.EXPO_OS === 'web' && (
          <T muted small>{t("The PDF is in English (its fonts can't show Hebrew).")}</T>
        )}
        <View style={[styles.wa, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <T selectable style={{ fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 }}>
            {text}
          </T>
        </View>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 14, gap: 12, width: '100%', maxWidth: 1000, alignSelf: 'center' },
  wa: { borderWidth: 1, borderRadius: 10, padding: 12 },
});
