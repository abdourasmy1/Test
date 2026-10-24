import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { CodeBlock } from '../components/CodeBlock';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { deleteSigningKey, customerAppPublicKeySnippet } from '../lib/keystore';
import { copyText } from '../lib/share';
import { formatDateAr } from '../lib/helpers';
import { userMessage } from '../lib/errors';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'More'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function MoreScreen({ navigation }: Props) {
  const { theme, mode, setMode } = useTheme();
  const c = theme.colors;
  const { keyInfo, keyReady, refreshKey, db } = useAppStore();
  const { toast, show } = useToast();
  const [showPubKey, setShowPubKey] = useState(false);

  const nav = (name: string, params?: any) => () => (navigation as any).navigate(name, params);

  const onCopySnippet = async () => {
    if (!keyInfo) return;
    if (await copyText(customerAppPublicKeySnippet(keyInfo))) show('تم نسخ كتلة المفتاح العام', 'success');
    else show('تعذر النسخ', 'error');
  };

  const onDeleteKey = () => {
    Alert.alert(
      'حذف مفتاح التوقيع؟',
      `تحذير شديد: حذف المفتاح يعني:\n• توقف إصدار التراخيص الجديدة\n• تعذر التحقق من التراخيص السابقة (${db.licenses.length} سجل)\n• الحاجة لمفتاح جديد ونسخة عميل جديدة\n\nتابع فقط إذا كان لديك نسخة احتياطية مشفرة.`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteSigningKey();
              await refreshKey();
              show('تم حذف مفتاح التوقيع', 'success');
            } catch (e) {
              show(userMessage(e), 'error');
            }
          },
        },
      ]
    );
  };

  const cycleTheme = () => {
    const next = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system';
    setMode(next);
    show(next === 'system' ? 'المظهر: تلقائي' : next === 'light' ? 'المظهر: فاتح' : 'المظهر: داكن', 'success');
  };

  const MenuItem = ({
    icon,
    title,
    sub,
    onPress,
    danger,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    sub: string;
    onPress: () => void;
    danger?: boolean;
  }) => (
    <Pressable
      onPress={onPress}
      style={[styles.item, { backgroundColor: c.card, borderColor: c.border, borderRadius: theme.radius.m }]}
    >
      <View style={[styles.itemIcon, { backgroundColor: (danger ? c.danger : c.primary) + '14' }]}>
        <Ionicons name={icon} size={20} color={danger ? c.danger : c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.itemTitle, { color: danger ? c.danger : c.text }]}>{title}</Text>
        <Text style={[styles.itemSub, { color: c.textSecondary }]}>{sub}</Text>
      </View>
      <Ionicons name="chevron-back" size={18} color={c.textMuted} />
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: c.text }]}>المزيد</Text>

        <Text style={[styles.section, { color: c.textSecondary }]}>مفتاح التوقيع</Text>
        <View style={[styles.keyCard, { backgroundColor: c.card, borderColor: keyReady ? c.success : c.danger }]}>
          <View style={styles.keyRow}>
            <Ionicons name={keyReady ? 'shield-checkmark' : 'warning'} size={26} color={keyReady ? c.success : c.danger} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.keyTitle, { color: c.text }]}>
                {keyReady ? 'المفتاح موجود وصالح' : 'لا يوجد مفتاح'}
              </Text>
              {keyReady && keyInfo ? (
                <Text style={[styles.keyFp, { color: c.textSecondary }]}>
                  البصمة: {keyInfo.fingerprint.slice(0, 16)}...{keyInfo.fingerprint.slice(-8)}
                  {keyInfo.createdAt ? ` • أُنشئ ${formatDateAr(keyInfo.createdAt)}` : ''}
                </Text>
              ) : (
                <Text style={[styles.keyFp, { color: c.textSecondary }]}>أنشئ المفتاح أو استعده للبدء بالإصدار</Text>
              )}
            </View>
          </View>
          {keyReady && keyInfo ? (
            <>
              <Pressable onPress={() => setShowPubKey(!showPubKey)} style={styles.pubToggle}>
                <Text style={[styles.pubToggleText, { color: c.primary }]}>
                  {showPubKey ? 'إخفاء المفتاح العام' : 'عرض المفتاح العام (للدمج في تطبيق العميل)'}
                </Text>
                <Ionicons name={showPubKey ? 'chevron-up' : 'chevron-down'} size={16} color={c.primary} />
              </Pressable>
              {showPubKey ? (
                <>
                  <CodeBlock value={keyInfo.publicKeyBase64} label="PUBLIC KEY (BASE64)" />
                  <CodeBlock value={keyInfo.fingerprintGrouped} label="FINGERPRINT (SHA-512/256)" copyable />
                  <Pressable onPress={onCopySnippet} style={[styles.snippetBtn, { borderColor: c.primary }]}>
                    <Ionicons name="copy-outline" size={16} color={c.primary} />
                    <Text style={[styles.snippetText, { color: c.primary }]}>نسخ كتلة الدمج لتطبيق العميل</Text>
                  </Pressable>
                  <Text style={[styles.safeNote, { color: c.textMuted }]}>
                    المفتاح العام آمن للمشاركة والتضمين في كود تطبيق العميل. المفتاح الخاص لا يظهر هنا أبداً.
                  </Text>
                </>
              ) : null}
            </>
          ) : null}
        </View>

        <Text style={[styles.section, { color: c.textSecondary }]}>إدارة المفتاح والبيانات</Text>
        <MenuItem icon="lock-closed-outline" title="نسخة احتياطية للمفتاح" sub="تصدير مشفّر بكلمة مرور (PMKB1)" onPress={nav('KeyBackup')} />
        <MenuItem icon="cloud-download-outline" title="استعادة المفتاح" sub="استيراد نسخة PMKB1 مشفرة" onPress={nav('KeyRestore')} />
        <MenuItem icon="server-outline" title="نسخة احتياطية للسجلات" sub="تصدير قاعدة البيانات مشفرة (PMDB1)" onPress={nav('DbBackup')} />
        <MenuItem icon="cloud-upload-outline" title="استعادة السجلات" sub="دمج نسخة PMDB1 مع التحقق من السلامة" onPress={nav('DbRestore')} />

        <Text style={[styles.section, { color: c.textSecondary }]}>الأدوات والتوثيق</Text>
        <MenuItem icon="flask-outline" title="أداة الاختبار" sub="توليد طلبات تفعيل تجريبية صالحة" onPress={nav('TestTool')} />
        <MenuItem icon="checkmark-done-outline" title="الاختبار الذاتي" sub="16 فحصاً حقيقياً للتشفير والتحقق" onPress={nav('SelfTest')} />
        <MenuItem icon="book-outline" title="التوثيق وبروتوكول الدمج" sub="صيغ البيانات وخطوات تطبيق العميل" onPress={nav('Docs')} />
        <MenuItem icon="contrast-outline" title={`المظهر: ${mode === 'system' ? 'تلقائي' : mode === 'light' ? 'فاتح' : 'داكن'}`} sub="اضغط للتبديل بين تلقائي / فاتح / داكن" onPress={cycleTheme} />

        <Text style={[styles.section, { color: c.textSecondary }]}>منطقة الخطر</Text>
        <MenuItem icon="trash-outline" title="حذف مفتاح التوقيع" sub="يوقف الإصدار والتحقق — لا يمكن التراجع" onPress={onDeleteKey} danger />

        <Text style={[styles.version, { color: c.textMuted }]}>
          مدير تراخيص Poultry Manager • الإصدار 1.0.0{'\n'}صيغة الترخيص v1 • Ed25519 • يعمل دون إنترنت
        </Text>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  section: { fontSize: 13, fontWeight: '800', marginTop: 16, marginBottom: 8 },
  keyCard: { borderWidth: 1.5, borderRadius: 16, padding: 14, marginBottom: 4 },
  keyRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  keyTitle: { fontSize: 15, fontWeight: '800' },
  keyFp: { fontSize: 12, marginTop: 4, fontFamily: 'monospace', lineHeight: 18 },
  pubToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 8 },
  pubToggleText: { fontSize: 13, fontWeight: '800' },
  snippetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: 12, padding: 12 },
  snippetText: { fontSize: 13.5, fontWeight: '800' },
  safeNote: { fontSize: 11.5, marginTop: 8, lineHeight: 17, textAlign: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, padding: 13, marginBottom: 8 },
  itemIcon: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 15, fontWeight: '800' },
  itemSub: { fontSize: 12.5, marginTop: 2 },
  version: { fontSize: 11.5, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});
