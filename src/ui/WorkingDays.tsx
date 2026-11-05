import { View } from 'react-native';

import type { DayMode, WorkingDay } from '@/domain/types';
import { DAY_MODES } from '@/domain/workdays';

import { useI18n } from './i18n';
import { Button, Choice, Row, T, TimeInput } from './kit';
import { useTheme } from './theme';

const MODE_LABELS: Record<DayMode, string> = {
  both: 'Both shifts',
  morning: 'Morning only',
  evening: 'Evening only',
  closed: 'Closed',
};

/** One row per day: open periods, plus an optional late evening start. */
export function WorkingDays(props: {
  rows: { key: string; label: string; sub?: string; day: WorkingDay }[];
  eveningDefault: string;
  onChange: (key: string, day: WorkingDay) => void;
  disabled?: boolean;
}) {
  const { rows, eveningDefault, onChange, disabled } = props;
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View style={{ gap: 4 }}>
      {rows.map(({ key, label, sub, day }) => {
        const hasEvening = day.mode === 'both' || day.mode === 'evening';
        return (
          <View
            key={key}
            style={{
              gap: 8,
              paddingVertical: 10,
              borderBottomWidth: 1,
              borderColor: theme.border,
              opacity: day.mode === 'closed' ? 0.7 : 1,
            }}>
            <Row>
              <T bold>{label}</T>
              {sub && <T muted small>{sub}</T>}
            </Row>
            <Choice
              disabled={disabled}
              onChange={(mode) => onChange(key, { ...day, mode })}
              options={DAY_MODES.map((m) => [m, t(MODE_LABELS[m])] as const)}
              value={day.mode}
            />
            {hasEvening && (
              <Row wrap>
                <T muted small>{t('Evening starts')}</T>
                <TimeInput
                  accessibilityLabel={t('Evening starts')}
                  allowEmpty
                  disabled={disabled}
                  onChange={(v) => onChange(key, { ...day, eveningStart: v || undefined })}
                  placeholder={eveningDefault}
                  value={day.eveningStart ?? ''}
                />
                {day.eveningStart && !disabled && (
                  <Button
                    label={t('usual')}
                    onPress={() => onChange(key, { mode: day.mode })}
                    small
                    variant="link"
                  />
                )}
              </Row>
            )}
          </View>
        );
      })}
    </View>
  );
}
