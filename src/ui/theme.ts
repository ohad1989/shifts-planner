import { createContext, use } from 'react';

const light = {
  scheme: 'light' as 'light' | 'dark',
  background: '#F4F2EE',
  surface: '#FFFFFF',
  border: '#E2DED6',
  borderStrong: '#CFC9BD',
  text: '#1D1F22',
  textMuted: '#6B6F76',
  accent: '#1F5F4A',
  onAccent: '#FFFFFF',
  accentSoft: '#E3EFE9',
  open: '#B4532A',
  openSoft: '#FBEEE6',
  cover: '#3A5EA8',
  coverSoft: '#E7EDF8',
  override: '#9B2C6A',
  overrideSoft: '#F7E6F0',
  warn: '#A8740B',
  warnSoft: '#FBF2DC',
  danger: '#B42323',
  dangerSoft: '#FBE5E5',
  onDanger: '#FFFFFF',
  good: '#2F7D4F',
  scrim: 'rgba(0,0,0,0.4)',
};

export type Theme = typeof light;

const dark: Theme = {
  scheme: 'dark',
  background: '#15171A',
  surface: '#1D2024',
  border: '#2C3036',
  borderStrong: '#3A3F46',
  text: '#E8E6E1',
  textMuted: '#9A9EA6',
  accent: '#5CBF98',
  onAccent: '#0E1A15',
  accentSoft: '#1C3229',
  open: '#EC9A6E',
  openSoft: '#3A261C',
  cover: '#8FB0F0',
  coverSoft: '#1F2A40',
  override: '#E58BBD',
  overrideSoft: '#3A1F2F',
  warn: '#E6B955',
  warnSoft: '#362C14',
  danger: '#F08080',
  dangerSoft: '#3D1D1D',
  onDanger: '#3D0B08',
  good: '#6FCF97',
  scrim: 'rgba(0,0,0,0.6)',
};

export const THEMES = { light, dark };

export const ThemeContext = createContext<Theme>(light);

export function useTheme(): Theme {
  return use(ThemeContext);
}
