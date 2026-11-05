import { createContext, use } from 'react';

import { periodLabel, roleLabel, translate, translateReason } from '@/domain/i18n';
import type { Lang, Period } from '@/domain/types';

export const I18nContext = createContext<Lang>('en');

export function useI18n() {
  const lang = use(I18nContext);
  return {
    lang,
    rtl: lang === 'he',
    t: (key: string, vars?: Record<string, string | number>) => translate(lang, key, vars),
    role: (r: string) => roleLabel(lang, r),
    period: (p: Period) => periodLabel(lang, p),
    reason: (s: string) => translateReason(lang, s),
  };
}
