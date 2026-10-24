import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.l,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function CardTitle({ icon, title, subtitle }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.titleRow}>
      {icon ? (
        <View style={[styles.iconBox, { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.s }]}>
          <Ionicons name={icon} size={20} color={theme.colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: theme.colors.textSecondary }]}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: theme.colors.border }]}>
      <Text style={[styles.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text
        style={[styles.value, { color: theme.colors.text, fontFamily: mono ? 'monospace' : undefined }]}
        selectable
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, padding: 16, marginBottom: 14 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  iconBox: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 9,
    borderBottomWidth: 1,
    gap: 12,
  },
  label: { fontSize: 13, flexShrink: 0, paddingTop: 1 },
  value: { fontSize: 13.5, fontWeight: '600', textAlign: 'left', flex: 1, flexWrap: 'wrap' },
});
