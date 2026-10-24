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
import { generateTestActivationRequest } from '../lib/crypto';
import { groupFingerprint } from '../lib/helpers';
import { copyText } from '../lib/share';
import type { RootStackParamList } from '../navigation/types';

export function TestToolScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'TestTool'>) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { toast, show } = useToast();
  const [installationId, setInstallationId] = useState('');
  const [generated, setGenerated] = useState<{
    request: string;
    fingerprint: string;
    devicePublicKeyBase64Url: string;
  } | null>(null);

  const onGenerate = () => {
    try {
      const id = installationId.trim();
      const res = generateTestActivationRequest(id || undefined);
      setGenerated(res);
      show('تم توليد طلب تفعيل تجريبي صالح', 'success');
    } catch {
      show('تعذر التوليد — تحقق من معرّف التثبيت', 'error');
    }
  };

  const onCopy = async () => {
    if (generated && (await copyText(generated.request))) show('تم نسخ الطلب التجريبي', 'success');
    else show('تعذر النسخ', 'error');
  };

  const onUseInForm = () => {
    if (!generated) return;
    (navigation as any).navigate('Main', {
      screen: 'NewLicense',
      params: { prefill: { activationRequest: generated.request } },
    });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>أداة الاختبار</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          توليد طلب تفعيل تجريبي صالح البنية (مفتاح جهاز عشوائي مؤقت) لاختبار دورة الإصدار والتحقق.
        </Text>

        <View style={[styles.warnBox, { backgroundColor: c.warning + '12', borderColor: c.warning }]}>
          <Ionicons name="flask-outline" size={22} color={c.warning} />
          <Text style={[styles.warnText, { color: c.text }]}>
            للاختبار فقط — طلبات العملاء الحقيقية تأتي من تطبيق العميل بمفاتيح أجهزتهم الفعلية. المفتاح
            التجريبي يُنسى فوراً ولا يُحفظ.
          </Text>
        </View>

        <Card>
          <CardTitle icon="qr-code-outline" title="توليد طلب تجريبي" />
          <Field
            label="Installation ID (اختياري — يُولّد تلقائياً إذا تُرك فارغاً)"
            value={installationId}
            onChangeText={setInstallationId}
            placeholder="مثال: TEST-DEVICE-001"
            autoCapitalize="characters"
            autoCorrect={false}
            mono
            hint="8-64 حرف: أحرف وأرقام و _ و - فقط"
          />
          <AppButton title="توليد طلب تجريبي" icon="flask" onPress={onGenerate} />
        </Card>

        {generated ? (
          <Card>
            <CardTitle icon="checkmark-circle-outline" title="الطلب التجريبي المولّد" />
            <CodeBlock value={generated.request} label="ACTIVATION REQUEST (PMAR1)" />
            <Text style={[styles.fpLabel, { color: c.textSecondary }]}>بصمة المفتاح التجريبي:</Text>
            <Text style={[styles.fp, { color: c.text }]} selectable>
              {groupFingerprint(generated.fingerprint)}
            </Text>
            <View style={{ height: 12 }} />
            <AppButton title="نسخ الطلب" icon="copy-outline" variant="secondary" onPress={onCopy} />
            <View style={{ height: 8 }} />
            <AppButton title="استخدامه في نموذج الترخيص" icon="arrow-forward" onPress={onUseInForm} />
          </Card>
        ) : null}
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
  warnBox: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14, alignItems: 'flex-start' },
  warnText: { flex: 1, fontSize: 13, lineHeight: 19 },
  fpLabel: { fontSize: 12.5, marginBottom: 4 },
  fp: { fontSize: 12, fontFamily: 'monospace', lineHeight: 18 },
});
