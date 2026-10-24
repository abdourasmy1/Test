import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Field } from '../components/Field';
import { CodeBlock } from '../components/CodeBlock';
import { Card, CardTitle } from '../components/Card';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { exportEncryptedKeyBackup, importEncryptedKeyBackup, keyExists } from '../lib/keystore';
import { copyText } from '../lib/share';
import { userMessage } from '../lib/errors';
import type { RootStackParamList } from '../navigation/types';

export function KeyBackupScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'KeyBackup'>) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { keyReady, keyInfo } = useAppStore();
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>نسخة احتياطية للمفتاح</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          تصدير مشفّر للمفتاح الخاص (XSalsa20-Poly1305) محمي بكلمة مرور. احفظ الناتج خارج هذا الجهاز.
        </Text>

        {!keyReady ? (
          <Card>
            <View style={styles.warnRow}>
              <Ionicons name="warning-outline" size={24} color={c.danger} />
              <Text style={[styles.warnText, { color: c.text }]}>لا يوجد مفتاح توقيع لتصديره.</Text>
            </View>
            <AppButton title="إنشاء مفتاح جديد" icon="key" onPress={() => navigation.navigate('SetupKey')} />
          </Card>
        ) : (
          <Card>
            <CardTitle icon="key-outline" title="المفتاح الحالي" subtitle={keyInfo ? `البصمة: ${keyInfo.fingerprint.slice(0, 24)}...` : ''} />
            {!backup ? (
              <>
                <Field
                  label="كلمة مرور النسخة (8 أحرف على الأقل)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="كلمة مرور قوية تحفظها جيداً"
                  returnKeyType="done"
                  onSubmitEditing={onExport}
                />
                <AppButton title="إنشاء النسخة المشفرة" icon="lock-closed" onPress={onExport} loading={busy} />
              </>
            ) : (
              <>
                <CodeBlock value={backup} label="KEY BACKUP (PMKB1)" />
                <AppButton title="نسخ النسخة" icon="copy-outline" onPress={onCopy} variant="secondary" />
                <AppButton
                  title="إنشاء نسخة جديدة"
                  variant="ghost"
                  onPress={() => {
                    setBackup(null);
                    setPassword('');
                  }}
                />
              </>
            )}
          </Card>
        )}

        <Card>
          <CardTitle icon="information-circle-outline" title="كيف تحفظ النسخة بأمان؟" />
          <Text style={[styles.tip, { color: c.textSecondary }]}>
            • احفظها في مكانين مختلفين على الأقل (مثلاً: USB + ورقة في خزنة).{'\n'}
            • لا ترسلها عبر واتساب أو بريد غير مشفّر مع كلمة المرور في نفس الرسالة.{'\n'}
            • كلمة المرور غير قابلة للاستعادة — فقدانها يعني فقدان النسخة.{'\n'}
            • أي تعديل على حرف واحد سيُكتشف عند الاستعادة وسيُرفض.
          </Text>
        </Card>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

export function KeyRestoreScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'KeyRestore'>) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { refreshKey } = useAppStore();
  const { toast, show } = useToast();
  const [backup, setBackup] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);

  React.useEffect(() => {
    keyExists().then(setExists);
  }, []);

  const onRestore = async () => {
    setBusy(true);
    try {
      const info = await importEncryptedKeyBackup(backup, password);
      await refreshKey();
      setExists(true);
      show(`تمت الاستعادة — البصمة: ${info.fingerprint.slice(0, 12)}...`, 'success');
      setTimeout(() => navigation.goBack(), 800);
    } catch (e) {
      show(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>استعادة المفتاح</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          الصق نسخة PMKB1 المشفرة وأدخل كلمة مرورها. كلمة خاطئة أو نسخة معدّلة = رفض تام.
        </Text>
        {exists ? (
          <Card>
            <View style={styles.warnRow}>
              <Ionicons name="warning-outline" size={24} color={c.warning} />
              <Text style={[styles.warnText, { color: c.text }]}>
                يوجد مفتاح حالي. يجب حذفه من شاشة «المزيد» قبل الاستعادة.
              </Text>
            </View>
          </Card>
        ) : (
          <Card>
            <CardTitle icon="cloud-download-outline" title="بيانات الاستعادة" />
            <Field
              label="نص النسخة الاحتياطية (PMKB1...)"
              value={backup}
              onChangeText={setBackup}
              placeholder="PMKB1...."
              multiline
              numberOfLines={4}
              mono
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="كلمة مرور النسخة"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="كلمة المرور المستخدمة عند التصدير"
              returnKeyType="done"
              onSubmitEditing={onRestore}
            />
            <AppButton title="استعادة المفتاح" icon="key" onPress={onRestore} loading={busy} disabled={!backup.trim() || !password} />
          </Card>
        )}
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  warnText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  tip: { fontSize: 13.5, lineHeight: 22 },
});
