import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { EmptyState } from '../components/EmptyState';
import { useAppStore } from '../store/appContext';
import { isExpired } from '../lib/db';
import { daysUntil, formatDateAr, truncateMiddle } from '../lib/helpers';
import type { LicenseRecord } from '../lib/types';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'History'>,
  NativeStackScreenProps<RootStackParamList>
>;

type Filter = 'all' | 'permanent' | 'temporary' | 'expired' | 'revoked';

const FILTERS: { key: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'all', label: 'الكل', icon: 'list-outline' },
  { key: 'permanent', label: 'دائم', icon: 'infinite-outline' },
  { key: 'temporary', label: 'مؤقت', icon: 'time-outline' },
  { key: 'expired', label: 'منتهي', icon: 'alert-circle-outline' },
  { key: 'revoked', label: 'ملغي', icon: 'ban-outline' },
];

export function HistoryScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { db, refreshDb } = useAppStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const now = Date.now();
    return db.licenses.filter((r) => {
      if (filter === 'permanent' && (r.type !== 'permanent' || r.revoked)) return false;
      if (filter === 'temporary' && (r.type !== 'temporary' || r.revoked)) return false;
      if (filter === 'expired' && (!isExpired(r, now) || r.revoked)) return false;
      if (filter === 'revoked' && !r.revoked) return false;
      if (!q) return true;
      return (
        r.customerName.toLowerCase().includes(q) ||
        r.customerNumber.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.installationId.toLowerCase().includes(q)
      );
    });
  }, [db.licenses, query, filter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshDb();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: LicenseRecord }) => {
    const expired = isExpired(item);
    const statusColor = item.revoked ? c.danger : expired ? c.warning : c.success;
    const statusText = item.revoked ? 'ملغي' : expired ? 'منتهي' : item.type === 'permanent' ? 'دائم — ساري' : `ساري — متبقٍ ${daysUntil(item.expiresAt!)} يوم`;
    return (
      <Pressable
        onPress={() => navigation.navigate('LicenseDetail' as any, { recordId: item.id } as any)}
        style={[styles.card, { backgroundColor: c.card, borderColor: c.border, borderRadius: theme.radius.l }]}
      >
        <View style={styles.rowTop}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: c.text }]} numberOfLines={1}>{item.customerName}</Text>
            <Text style={[styles.num, { color: c.textSecondary }]} numberOfLines={1}>
              {item.customerNumber} • {item.id}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
            <Text style={[styles.badgeText, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>
        <View style={styles.rowBottom}>
          <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
            <Ionicons name="calendar-outline" size={12} /> {formatDateAr(item.issuedAt)}
            {item.expiresAt ? `  •  ينتهي ${formatDateAr(item.expiresAt)}` : ''}
          </Text>
          <Text style={[styles.metaMono, { color: c.textMuted }]} numberOfLines={1}>
            {truncateMiddle(item.installationId, 12, 6)}
          </Text>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.h1, { color: c.text }]}>سجل التراخيص</Text>
        <Text style={[styles.count, { color: c.textSecondary }]}>
          {items.length} من {db.licenses.length} ترخيص
        </Text>
      </View>

      <View style={[styles.searchBox, { backgroundColor: c.inputBg, borderColor: c.border, borderRadius: theme.radius.m }]}>
        <Ionicons name="search-outline" size={20} color={c.textMuted} />
        <TextInput
          style={[styles.search, { color: c.text }]}
          placeholder="بحث برقم العميل، الاسم، أو معرّف الترخيص..."
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={c.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          inverted
          data={FILTERS}
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
          renderItem={({ item: f }) => {
            const active = filter === f.key;
            return (
              <Pressable
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? c.primary : c.card,
                    borderColor: active ? c.primary : c.border,
                  },
                ]}
              >
                <Ionicons name={f.icon} size={15} color={active ? '#fff' : c.textSecondary} />
                <Text style={[styles.chipText, { color: active ? '#fff' : c.textSecondary }]}>{f.label}</Text>
              </Pressable>
            );
          }}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="folder-open-outline"
            title={query || filter !== 'all' ? 'لا توجد نتائج مطابقة' : 'لا توجد تراخيص بعد'}
            subtitle={
              query || filter !== 'all'
                ? 'جرّب بحثاً مختلفاً أو غيّر الفلتر'
                : 'أصدر أول ترخيص من تبويب «ترخيص جديد» وسيظهر هنا تلقائياً'
            }
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  h1: { fontSize: 22, fontWeight: '900' },
  count: { fontSize: 13 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, marginHorizontal: 16, paddingHorizontal: 12, height: 48, marginBottom: 10 },
  search: { flex: 1, fontSize: 14, textAlign: 'right' },
  filters: { marginBottom: 8 },
  filtersContent: { paddingHorizontal: 16, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, marginEnd: 8 },
  chipText: { fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { borderWidth: 1, padding: 14, marginBottom: 10 },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  name: { fontSize: 16, fontWeight: '800' },
  num: { fontSize: 12.5, marginTop: 3 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 11.5, fontWeight: '800' },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  meta: { fontSize: 12, flex: 1 },
  metaMono: { fontSize: 11, fontFamily: 'monospace' },
});
