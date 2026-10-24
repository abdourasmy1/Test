import type { ThemeMode } from './types';

export interface ThemeColors {
  primary: string;
  primaryDark: string;
  primarySoft: string;
  accent: string;
  background: string;
  surface: string;
  card: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  onPrimary: string;
  inputBg: string;
  codeBg: string;
  tabInactive: string;
}

export interface AppTheme {
  dark: boolean;
  mode: ThemeMode;
  colors: ThemeColors;
  radius: { s: number; m: number; l: number; xl: number };
}

const lightColors: ThemeColors = {
  primary: '#1B7A43',
  primaryDark: '#145C32',
  primarySoft: '#E3F2E9',
  accent: '#D9932B',
  background: '#F2F5F1',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  text: '#152419',
  textSecondary: '#43564A',
  textMuted: '#8AA094',
  border: '#DCE5DD',
  success: '#1B7A43',
  warning: '#B97A12',
  danger: '#C0392B',
  info: '#2471A3',
  onPrimary: '#FFFFFF',
  inputBg: '#FFFFFF',
  codeBg: '#10231A',
  tabInactive: '#8AA094',
};

const darkColors: ThemeColors = {
  primary: '#3ECF7F',
  primaryDark: '#2AA866',
  primarySoft: '#14301F',
  accent: '#E8A93D',
  background: '#0C130F',
  surface: '#141D18',
  card: '#182420',
  text: '#EAF3ED',
  textSecondary: '#A9BFAF',
  textMuted: '#6E8577',
  border: '#2A3830',
  success: '#3ECF7F',
  warning: '#E8A93D',
  danger: '#E4695B',
  info: '#5DADE2',
  onPrimary: '#0C130F',
  inputBg: '#182420',
  codeBg: '#050A08',
  tabInactive: '#6E8577',
};

export function buildTheme(mode: ThemeMode, systemDark: boolean): AppTheme {
  const dark = mode === 'dark' ? true : mode === 'light' ? false : systemDark;
  return {
    dark,
    mode,
    colors: dark ? darkColors : lightColors,
    radius: { s: 8, m: 12, l: 16, xl: 22 },
  };
}

export const spacing = (n: number): number => n * 4;
