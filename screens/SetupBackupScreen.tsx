import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Field } from '../components/Field';
import { CodeBlock } from '../components/CodeBlock';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { exportEncryptedKeyBackup } from '../lib/keystore';
import { copyText } from '../lib/share';
import { userMessage } from '../lib/errors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'SetupBackup'>;

export function SetupBackupScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { completeSetup } = useAppStore();
  const { toast, show } = useToast();
  const [password, setPassword] = useState('');
  const [backup, setBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      const b = await exportEncryptedKeyBackup(password);
      setBackup(b);
      show('تم إنشاء النسخة الاحتياطية المشفرة', 'success');
    } catch (e) {
      show(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    if (backup && (await copyText(backup))) show('تم نسخ النسخة الاحتياطية', 'success');
    else show('تعذر النسخ', 'error');
  };

  const onFinish = async (copied: boolean) => {
    if (!copied) {
      show('احفظ النسخة الاحتياطية في مكان آمن قبل المتابعة', 'error');
      return;
    }
    await completeSetup();
    navigation.replace('Main');
  };

  const [confirmed, setConfirmed] = useState(false);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Ionicons name="checkmark-circle" size={30} color={c.success} />
          <Text style={[styles.h1, { color: c.text }]}>الخطوة 2: النسخة الاحتياطية للمفتاح</Text>
        </View>
        <Text style={[styles.p, { color: c.textSecondary }]}>
          إذا فقدت مفتاح التوقيع فلن تتمكن من إصدار تراخيص جديدة تطابق المفتاح القديم. أنشئ الآن
          نسخة احتياطية مشفرة بكلمة مرور واحفظها خارج هذا الجهاز (ورقة، USB، مدير كلمات مرور).
        </Text>

        <View style={[styles.dangerBox, { backgroundColor: c.danger + '14', borderColor: c.danger }]}>
          <Ionicons name="warning" size={20} color={c.danger} />
          <Text style={[styles.dangerText, { color: c.danger }]}>
            كلمة المرور هذه هي حمايتك الوحيدة — لا يمكن استعادة النسخة بدونها، ولا يمكننا استعادتها لك.
          </Text>
        </View>

        {!backup ? (
          <>
            <Field
              label="كلمة مرور النسخة الاحتياطية (8 أحرف على الأقل)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="أدخل كلمة مرور قوية"
              returnKeyType="done"
              onSubmitEditing={onExport}
            />
            <AppButton title="إنشاء النسخة الاحتياطية المشفرة" icon="lock-closed" onPress={onExport} loading={busy} />
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: c.text }]}>النسخة الاحتياطية المشفرة (تبدأ بـ PMKB1):</Text>
            <CodeBlock value={backup} label="KEY BACKUP" />
            <AppButton title="نسخ النسخة الاحتياطية" icon="copy-outline" onPress={onCopy} variant="secondary" />
            <View style={styles.confirmRow}>
              <Ionicons
                name={confirmed ? 'checkbox' : 'square-outline'}
                size={24}
                color={c.primary}
                onPress={() => setConfirmed(!confirmed)}
              />
              <Text style={[styles.confirmText, { color: c.text }]} onPress={() => setConfirmed(!confirmed)}>
                أؤكد أنني حفظت النسخة الاحتياطية وكلمة المرور في مكان آمن خارج هذا الجهاز
              </Text>
            </View>
            <AppButton title="إنهاء الإعداد والدخول" icon="arrow-forward" onPress={() => onFinish(confirmed)} style={{ marginTop: 8 }} />
          </>
        )}
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  h1: { fontSize: 18, fontWeight: '800', flex: 1 },
  p: { fontSize: 14, lineHeight: 22, marginBottom: 14 },
  dangerBox: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 14, padding: 13, marginBottom: 16, alignItems: 'flex-start' },
  dangerText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  confirmRow: { flexDirection: 'row', gap: 10, marginTop: 16, alignItems: 'flex-start' },
  confirmText: { flex: 1, fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
});
