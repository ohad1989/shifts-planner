import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { ActivityIndicator, Text, View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DATABASE_NAME, migrate } from '@/data/db';
import { useStore } from '@/data/useStore';
import { setDateLang } from '@/domain/dates';
import { translate } from '@/domain/i18n';
import type { Lang } from '@/domain/types';
import { AppStateProvider } from '@/ui/AppState';
import { HeaderPrefs } from '@/ui/HeaderPrefs';
import { I18nContext } from '@/ui/i18n';
import { Banner, Button, H, T } from '@/ui/kit';
import { THEMES, ThemeContext } from '@/ui/theme';

const TAB_ICONS: Record<string, string> = {
  index: '▦',
  publish: '⇪',
  people: '☺',
  settings: '⚙',
};

function Shell() {
  const s = useStore();
  const system = useColorScheme();
  const lang: Lang = s.store?.settings.language ?? 'en';
  const pref = s.store?.settings.theme ?? 'system';
  const theme = THEMES[pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref];
  const t = (key: string) => translate(lang, key);
  setDateLang(lang);

  useEffect(() => {
    if (process.env.EXPO_OS !== 'web') return;
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
    root.style.colorScheme = theme.scheme;
    document.title = translate(lang, 'Shift Planner');
  }, [lang, theme.scheme]);

  if (!s.store) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: theme.background }}>
        {s.error ? (
          <ThemeContext value={theme}>
            <H>{t("Can't read the data")}</H>
            <T muted>{s.error}</T>
            <Button label={t('Retry')} onPress={() => void s.reload()} variant="primary" />
          </ThemeContext>
        ) : (
          <ActivityIndicator color={theme.accent} />
        )}
      </View>
    );
  }

  return (
    <ThemeContext value={theme}>
      <I18nContext value={lang}>
        <AppStateProvider s={s} store={s.store}>
          <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
          <View style={{ flex: 1, direction: lang === 'he' ? 'rtl' : 'ltr', backgroundColor: theme.background }}>
            {s.error && (
              <View style={{ padding: 8 }}>
                <Banner
                  action={<Button label={t('Dismiss')} onPress={s.clearError} small variant="link" />}
                  tone="error">
                  {s.error}
                </Banner>
              </View>
            )}
            <Tabs
              screenOptions={({ route }) => ({
                headerStyle: { backgroundColor: theme.surface },
                headerTintColor: theme.text,
                headerShadowVisible: false,
                headerRight: () => <HeaderPrefs />,
                sceneStyle: { backgroundColor: theme.background },
                tabBarStyle: { backgroundColor: theme.surface, borderTopColor: theme.border },
                tabBarActiveTintColor: theme.accent,
                tabBarInactiveTintColor: theme.textMuted,
                tabBarIcon: ({ color }) => (
                  <Text style={{ color, fontSize: 18 }}>{TAB_ICONS[route.name] ?? '•'}</Text>
                ),
              })}>
              <Tabs.Screen name="index" options={{ title: t('Planner') }} />
              <Tabs.Screen name="publish" options={{ title: t('Publish') }} />
              <Tabs.Screen name="people" options={{ title: t('People') }} />
              <Tabs.Screen name="settings" options={{ title: t('Settings') }} />
            </Tabs>
          </View>
        </AppStateProvider>
      </I18nContext>
    </ThemeContext>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrate}>
        <Shell />
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}
