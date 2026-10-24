import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';
import { copyText } from '../lib/share';

export function CodeBlock({
  value,
  maxHeight = 180,
  copyable = true,
  label,
}: {
  value: string;
  maxHeight?: number;
  copyable?: boolean;
  label?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [copied, setCopied] = React.useState(false);

  const onCopy = async () => {
    const ok = await copyText(value);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.codeBg, borderRadius: theme.radius.m }]}>
      <View style={styles.header}>
        <Text style={styles.label}>{label ?? 'CODE'}</Text>
        {copyable ? (
          <Pressable onPress={onCopy} style={styles.copyBtn} hitSlop={8}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color={copied ? '#3ECF7F' : '#9FB4A8'} />
            <Text style={[styles.copyText, { color: copied ? '#3ECF7F' : '#9FB4A8' }]}>
              {copied ? 'تم النسخ' : 'نسخ'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.code, { maxHeight }]} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  label: { color: '#6E8577', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  copyText: { fontSize: 12, fontWeight: '700' },
  code: {
    color: '#C9F2D8',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'left',
  },
});
