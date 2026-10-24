import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import type { ThemeMode } from '../lib/types';
import { buildTheme, type AppTheme } from '../lib/theme';

interface ThemeCtx {
  theme: AppTheme;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({
  mode,
  setMode,
  children,
}: {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  children: React.ReactNode;
}) {
  const system = useColorScheme();
  const theme = useMemo(() => buildTheme(mode, system === 'dark'), [mode, system]);
  const value = useMemo(() => ({ theme, mode, setMode }), [theme, mode, setMode]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme outside provider');
  return v;
}
