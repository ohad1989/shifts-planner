import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatWeekRange } from '@/domain/dates';

import { useApp } from './AppState';
import { useI18n } from './i18n';
import { Button, IconButton, Pill, Row, T } from './kit';
import { useTheme } from './theme';

/** Restaurant switcher and week navigation for the Planner and Publish screens. */
export function WeekBar() {
  const { store, week, restaurantId, setRestaurantId, weekOffset, setWeekOffset } = useApp();
  const theme = useTheme();
  const { t, rtl } = useI18n();
  const prev = rtl ? '›' : '‹';
  const next = rtl ? '‹' : '›';

  return (
    <View style={styles.bar}>
      <View style={[styles.seg, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        {store.settings.restaurants.map((r) => {
          const active = restaurantId === r.id;
          const published = week.status[r.id] === 'published';
          return (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              key={r.id}
              onPress={() => setRestaurantId(r.id)}
              style={[styles.segItem, active && { backgroundColor: theme.accentSoft }]}>
              <Text style={{ color: active ? theme.accent : theme.text, fontWeight: '600', fontSize: 15 }}>
                {r.name}
              </Text>
              <Pill label={published ? t('Published') : t('Draft')} tone={published ? 'accent' : 'muted'} />
            </Pressable>
          );
        })}
      </View>
      <Row gap={6}>
        <IconButton icon={prev} label={t('Previous week')} onPress={() => setWeekOffset((w) => w - 1)} />
        <T bold>{formatWeekRange(week.weekStart)}</T>
        <IconButton icon={next} label={t('Next week')} onPress={() => setWeekOffset((w) => w + 1)} />
        {weekOffset !== 0 && (
          <Button label={t('This week')} onPress={() => setWeekOffset(() => 0)} variant="link" />
        )}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  seg: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, padding: 3, gap: 3 },
  segItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
});
