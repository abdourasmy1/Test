import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { createAndStoreKeyPair } from '../lib/keystore';
import { userMessage } from '../lib/errors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SetupKey'>;

export function SetupKeyScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { refreshKey, completeSetup } = useAppStore();
  const { toast, show } = useToast();
  const [busy, setBusy] = useState(false);

  const onCreate = async () => {
    setBusy(true);
    try {
      await createAndStoreKeyPair();
      await refreshKey();
      show('تم إنشاء مفتاح التوقيع وتخزينه بأمان', 'success');
      setTimeout(() => navigation.replace('SetupBackup'), 600);
    } catch (e) {
      show(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onSkip = async () => {
    await completeSetup();
    navigation.replace('Main');
  };

  const bullets = [
    { icon: 'key-outline', text: 'يتم توليد زوج مفاتيح Ed25519 حقيقي بعشوائية آمنة داخل جهازك.' },
    { icon: 'shield-checkmark-outline', text: 'المفتاح الخاص لا يغادر التخزين الآمن أبداً ولا يظهر على الشاشة.' },
    { icon: 'phone-portrait-outline', text: 'المفتاح العام فقط هو ما ستدمجه في تطبيق العميل للتحقق.' },
    { icon: 'cloud-offline-outline', text: 'كل شيء يعمل دون إنترنت بعد الإعداد — لا خوادم ولا اشتراكات.' },
  ];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.hero, { backgroundColor: c.primary }]}>
          <Ionicons name="shield-checkmark" size={54} color="#fff" />
          <Text style={styles.heroTitle}>مدير تراخيص{'\n'}Poultry Manager</Text>
          <Text style={styles.heroSub}>أداة المطوّر لتوليد التراخيص الموقّعة وإدارتها</Text>
        </View>

        <Text style={[styles.h1, { color: c.text }]}>الخطوة 1: إنشاء مفتاح التوقيع</Text>
        <Text style={[styles.p, { color: c.textSecondary }]}>
          قبل إصدار أي ترخيص، يجب إنشاء مفتاح التوقيع الخاص بك. هذا المفتاح هو أساس الثقة في نظام
          التراخيص كله — حافظ عليه.
        </Text>

        {bullets.map((b, i) => (
          <View key={i} style={[styles.bullet, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name={b.icon as any} size={22} color={c.primary} />
            <Text style={[styles.bulletText, { color: c.text }]}>{b.text}</Text>
          </View>
        ))}

        <AppButton title="إنشاء مفتاح التوقيع" icon="key" onPress={onCreate} loading={busy} style={styles.cta} />
        <AppButton title="تخطي الآن (لن أتمكن من الإصدار)" variant="ghost" onPress={onSkip} />
        <Text style={[styles.warn, { color: c.textMuted }]}>
          بدون مفتاح توقيع صالح سيتم منع إصدار التراخيص وعرض رسالة خطأ واضحة.
        </Text>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  hero: {
    borderRadius: 22,
    padding: 26,
    alignItems: 'center',
    marginBottom: 22,
  },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 12, lineHeight: 32 },
  heroSub: { color: '#D6EBDD', fontSize: 13.5, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  h1: { fontSize: 19, fontWeight: '800', marginBottom: 8 },
  p: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  bullet: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 13,
    marginBottom: 10,
  },
  bulletText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  cta: { marginTop: 10, marginBottom: 6 },
  warn: { fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 },
});
