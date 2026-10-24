import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CheckItem } from '../lib/types';
import { useTheme } from './ThemeContext';

const ICONS: Record<CheckItem['status'], keyof typeof Ionicons.glyphMap> = {
  pass: 'checkmark-circle',
  fail: 'close-circle',
  warn: 'warning',
  info: 'information-circle',
};

export function CheckList({ checks }: { checks: CheckItem[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const colorFor = (s: CheckItem['status']) =>
    s === 'pass' ? c.success : s === 'fail' ? c.danger : s === 'warn' ? c.warning : c.info;
  return (
    <View>
      {checks.map((ch) => (
        <View key={ch.key} style={[styles.row, { borderBottomColor: c.border }]}>
          <Ionicons name={ICONS[ch.status]} size={22} color={colorFor(ch.status)} />
          <View style={styles.texts}>
            <Text style={[styles.label, { color: c.text }]}>{ch.label}</Text>
            {ch.detail ? <Text style={[styles.detail, { color: c.textSecondary }]}>{ch.detail}</Text> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: 1 },
  texts: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700' },
  detail: { fontSize: 12.5, marginTop: 2, lineHeight: 18 },
});
