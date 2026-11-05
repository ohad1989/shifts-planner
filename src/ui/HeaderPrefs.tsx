import { Pressable, Text, View } from 'react-native';

import type { Lang, Theme as ThemePref } from '@/domain/types';

import { useApp } from './AppState';
import { useI18n } from './i18n';
import { useTheme } from './theme';

const THEME_NEXT: Record<ThemePref, ThemePref> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_ICON: Record<ThemePref, string> = { system: '◐', light: '☀', dark: '☾' };

/** Save state, language and theme, shown in every screen's header. */
export function HeaderPrefs() {
  const { s, store } = useApp();
  const theme = useTheme();
  const { t, lang } = useI18n();
  const pref = store.settings.theme ?? 'system';
  const setPref = (patch: { language?: Lang; theme?: ThemePref }) =>
    s.saveSettings({ ...store.settings, ...patch });

  const status = s.saving
    ? t('Saving…')
    : s.savedAt
      ? t('Saved {time}', {
          time: s.savedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        })
      : t('All data on this device');

  const pill = (active: boolean) => ({
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: active ? theme.accentSoft : 'transparent',
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingStart: 12, paddingEnd: 16 }}>
      <Text numberOfLines={1} style={{ color: s.saving ? theme.warn : theme.textMuted, fontSize: 12, maxWidth: 110 }}>
        {status}
      </Text>
      <View style={{ flexDirection: 'row', borderWidth: 1, borderColor: theme.border, borderRadius: 8, padding: 2 }}>
        {(['en', 'he'] as Lang[]).map((l) => (
          <Pressable
            accessibilityLabel={t('Language')}
            accessibilityRole="button"
            accessibilityState={{ selected: lang === l }}
            key={l}
            onPress={() => setPref({ language: l })}
            style={pill(lang === l)}>
            <Text style={{ color: lang === l ? theme.accent : theme.text, fontWeight: '600', fontSize: 13 }}>
              {l === 'en' ? 'EN' : 'עב'}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityLabel={t('Theme: {mode}', { mode: t(`theme.${pref}`) })}
        accessibilityRole="button"
        hitSlop={8}
        onPress={() => setPref({ theme: THEME_NEXT[pref] })}
        style={{ width: 28, alignItems: 'center' }}>
        <Text style={{ color: theme.text, fontSize: 18 }}>{THEME_ICON[pref]}</Text>
      </Pressable>
    </View>
  );
}
