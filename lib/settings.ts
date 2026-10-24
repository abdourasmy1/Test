import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppSettings } from './types';

const KEY = 'pm_app_settings_v1';

const DEFAULTS: AppSettings = { themeMode: 'system', setupComplete: false };

export async function loadSettings(): Promise<AppSettings> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const obj = JSON.parse(raw);
    return {
      themeMode: obj.themeMode === 'light' || obj.themeMode === 'dark' ? obj.themeMode : 'system',
      setupComplete: obj.setupComplete === true,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // non-fatal
  }
}

export const LAST_REPORT_KEY = 'pm_last_selftest_report_v1';
