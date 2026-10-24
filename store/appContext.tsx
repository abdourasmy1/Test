import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { AppSettings, DbSchema, ThemeMode } from '../lib/types';
import type { KeyInfo } from '../lib/keystore';
import { loadDb } from '../lib/db';
import { getPublicKeyInfo } from '../lib/keystore';
import { loadSettings, saveSettings } from '../lib/settings';

interface AppStore {
  ready: boolean;
  settings: AppSettings;
  setThemeMode: (m: ThemeMode) => Promise<void>;
  completeSetup: () => Promise<void>;
  db: DbSchema;
  refreshDb: () => Promise<void>;
  setDb: (db: DbSchema) => void;
  keyInfo: KeyInfo | null;
  keyReady: boolean;
  refreshKey: () => Promise<void>;
}

const Ctx = createContext<AppStore | null>(null);

const EMPTY_DB: DbSchema = { version: 1, licenses: [], customers: [], updatedAt: 0 };

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ themeMode: 'system', setupComplete: false });
  const [db, setDbState] = useState<DbSchema>(EMPTY_DB);
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null);

  const refreshDb = useCallback(async () => {
    try {
      setDbState(await loadDb());
    } catch {
      setDbState({ ...EMPTY_DB });
    }
  }, []);

  const refreshKey = useCallback(async () => {
    try {
      setKeyInfo(await getPublicKeyInfo());
    } catch {
      setKeyInfo(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const s = await loadSettings();
      setSettings(s);
      await Promise.all([refreshDb(), refreshKey()]);
      setReady(true);
    })();
  }, [refreshDb, refreshKey]);

  const setThemeMode = useCallback(async (m: ThemeMode) => {
    setSettings((prev) => {
      const next = { ...prev, themeMode: m };
      saveSettings(next);
      return next;
    });
  }, []);

  const completeSetup = useCallback(async () => {
    setSettings((prev) => {
      const next = { ...prev, setupComplete: true };
      saveSettings(next);
      return next;
    });
  }, []);

  const setDb = useCallback((next: DbSchema) => setDbState(next), []);

  const value = useMemo<AppStore>(
    () => ({
      ready,
      settings,
      setThemeMode,
      completeSetup,
      db,
      refreshDb,
      setDb,
      keyInfo,
      keyReady: keyInfo !== null,
      refreshKey,
    }),
    [ready, settings, setThemeMode, completeSetup, db, refreshDb, setDb, keyInfo, refreshKey]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore(): AppStore {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppStore outside provider');
  return v;
}
