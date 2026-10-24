import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { Card } from '../components/Card';
import { useAppStore } from '../store/appContext';
import { getStats, isExpired } from '../lib/db';
import { formatDateAr } from '../lib/helpers';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Home'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function HomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { db, keyReady, keyInfo } = useAppStore();
  const stats = getStats(db);
  const recent = db.licenses.slice(0, 3);

  const statsCards = [
    { label: 'إجمالي التراخيص', value: stats.total, icon: 'document-text-outline', color: c.primary },
    { label: 'دائمة', value: stats.permanent, icon: 'infinite-outline', color: c.info },
    { label: 'مؤقتة سارية', value: stats.temporary - stats.expired, icon: 'time-outline', color: c.success },
    { label: 'منتهية', value: stats.expired, icon: 'alert-circle-outline', color: c.warning },
    { label: 'ملغاة', value: stats.revoked, icon: 'ban-outline', color: c.danger },
    { label: 'العملاء', value: stats.customers, icon: 'people-outline', color: c.accent },
  ];

  const actions = [
    {
      title: 'ترخيص جديد',
      sub: 'توليد وتوقيع ترخيص',
      icon: 'add-circle',
      color: c.primary,
      onPress: () => (navigation as any).navigate('NewLicense'),
    },
    {
      title: 'التحقق',
      sub: 'فحص كود ترخيص',
      icon: 'shield-checkmark',
      color: c.info,
      onPress: () => (navigation as any).navigate('Verify'),
    },
    {
      title: 'السجل',
      sub: 'التراخيص والعملاء',
      icon: 'folder-open',
      color: c.accent,
      onPress: () => (navigation as any).navigate('History'),
    },
    {
      title: 'المفتاح',
      sub: 'إدارة مفتاح التوقيع',
      icon: 'key',
      color: c.success,
      onPress: () => (navigation as any).navigate('KeyBackup'),
    },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: c.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.heroTitle}>مدير التراخيص</Text>
              <Text style={styles.heroSub}>Poultry Manager — أداة المطوّر</Text>
            </View>
            <View style={styles.heroIcon}>
              <Ionicons name="shield-checkmark" size={30} color={c.primary} />
            </View>
          </View>
          <View style={[styles.keyPill, { backgroundColor: keyReady ? '#FFFFFF2E' : '#00000033' }]}>
            <Ionicons
              name={keyReady ? 'checkmark-circle' : 'warning'}
              size={16}
              color="#fff"
            />
            <Text style={styles.keyPillText}>
              {keyReady
                ? `مفتاح التوقيع جاهز${keyInfo ? ` • ${keyInfo.fingerprint.slice(0, 8)}…` : ''}`
                : 'لا يوجد مفتاح توقيع — الإصدار متوقف'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable
              key={a.title}
              onPress={a.onPress}
              style={[styles.action, { backgroundColor: c.card, borderColor: c.border, borderRadius: theme.radius.l }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + '1A' }]}>
                <Ionicons name={a.icon as any} size={24} color={a.color} />
              </View>
              <Text style={[styles.actionTitle, { color: c.text }]}>{a.title}</Text>
              <Text style={[styles.actionSub, { color: c.textMuted }]}>{a.sub}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionTitle, { color: c.text }]}>نظرة عامة</Text>
        <View style={styles.grid}>
          {statsCards.map((s) => (
            <View
              key={s.label}
              style={[styles.stat, { backgroundColor: c.card, borderColor: c.border, borderRadius: theme.radius.m }]}
            >
              <Ionicons name={s.icon as any} size={20} color={s.color} />
              <Text style={[styles.statValue, { color: c.text }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: c.textSecondary }]}>{s.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>أحدث التراخيص</Text>
          {db.licenses.length > 0 ? (
            <Pressable onPress={() => (navigation as any).navigate('History')}>
              <Text style={[styles.seeAll, { color: c.primary }]}>عرض الكل ←</Text>
            </Pressable>
          ) : null}
        </View>

        {recent.length === 0 ? (
          <Card>
            <View style={styles.emptyRow}>
              <Ionicons name="document-text-outline" size={28} color={c.textMuted} />
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>
                لم تصدر أي ترخيص بعد. ابدأ من زر «ترخيص جديد».
              </Text>
            </View>
          </Card>
        ) : (
          recent.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => navigation.navigate('LicenseDetail' as any, { recordId: r.id } as any)}
              style={[styles.recentCard, { backgroundColor: c.card, borderColor: c.border, borderRadius: theme.radius.l }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.recentName, { color: c.text }]} numberOfLines={1}>{r.customerName}</Text>
                <Text style={[styles.recentMeta, { color: c.textSecondary }]} numberOfLines={1}>
                  {r.customerNumber} • {formatDateAr(r.issuedAt)}
                  {r.type === 'temporary' && r.expiresAt ? ` • ينتهي ${formatDateAr(r.expiresAt)}` : ' • دائم'}
                </Text>
              </View>
              <View
                style={[
                  styles.recentBadge,
                  {
                    backgroundColor: r.revoked
                      ? c.danger + '18'
                      : isExpired(r)
                        ? c.warning + '18'
                        : c.success + '18',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.recentBadgeText,
                    { color: r.revoked ? c.danger : isExpired(r) ? c.warning : c.success },
                  ]}
                >
                  {r.revoked ? 'ملغي' : isExpired(r) ? 'منتهي' : 'ساري'}
                </Text>
              </View>
              <Ionicons name="chevron-back" size={18} color={c.textMuted} />
            </Pressable>
          ))
        )}

        <Text style={[styles.offline, { color: c.textMuted }]}>
          <Ionicons name="cloud-offline-outline" size={12} /> يعمل دون إنترنت — جميع البيانات على هذا الجهاز فقط
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  hero: { borderRadius: 22, padding: 18, marginBottom: 14 },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  heroTitle: { color: '#fff', fontSize: 23, fontWeight: '900' },
  heroSub: { color: '#D6EBDD', fontSize: 13, marginTop: 4 },
  heroIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  keyPill: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  keyPillText: { color: '#fff', fontSize: 12.5, fontWeight: '700', flex: 1 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 18 },
  action: { width: '48%', borderWidth: 1, padding: 14, alignItems: 'center', flexGrow: 1 },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionTitle: { fontSize: 15, fontWeight: '800' },
  actionSub: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 10 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18, marginBottom: 10 },
  seeAll: { fontSize: 13, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '31%', borderWidth: 1, padding: 12, alignItems: 'center', flexGrow: 1 },
  statValue: { fontSize: 22, fontWeight: '900', marginTop: 6 },
  statLabel: { fontSize: 11.5, marginTop: 2, textAlign: 'center' },
  recentCard: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, padding: 13, marginBottom: 8 },
  recentName: { fontSize: 15, fontWeight: '800' },
  recentMeta: { fontSize: 12, marginTop: 3 },
  recentBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  recentBadgeText: { fontSize: 11.5, fontWeight: '800' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emptyText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  offline: { fontSize: 12, textAlign: 'center', marginTop: 16 },
});
