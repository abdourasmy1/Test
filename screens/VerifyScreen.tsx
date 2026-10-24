import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Field } from '../components/Field';
import { Card, CardTitle, InfoRow } from '../components/Card';
import { CheckList } from '../components/CheckList';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { verifyLicenseCode, PRODUCT_ID } from '../lib/crypto';
import { base64Decode, hexEncode } from '../lib/helpers';
import { formatDateAr, formatDateTimeAr, daysUntil } from '../lib/helpers';
import { copyText } from '../lib/share';
import type { CheckItem } from '../lib/types';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'Verify'>,
  NativeStackScreenProps<RootStackParamList>
>;

export function VerifyScreen({ route }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { keyInfo } = useAppStore();
  const { toast, show } = useToast();
  const initialCode = (route.params as any)?.code ?? '';
  const [code, setCode] = useState(initialCode);
  const [appliedInitial, setAppliedInitial] = useState(initialCode);
  if (initialCode !== appliedInitial) {
    setAppliedInitial(initialCode);
    setCode(initialCode);
  }
  const [expectedInstallationId, setExpectedInstallationId] = useState('');
  const [expectedFingerprint, setExpectedFingerprint] = useState('');
  const [submitted, setSubmitted] = useState(initialCode ? true : false);

  const result = useMemo(() => {
    if (!submitted || !code.trim()) return null;
    const pub = keyInfo ? keyInfo.publicKey : null;
    return verifyLicenseCode(code, pub, {
      expectedInstallationId: expectedInstallationId.trim() || undefined,
      expectedFingerprint: expectedFingerprint.trim().toLowerCase() || undefined,
    });
  }, [submitted, code, expectedInstallationId, expectedFingerprint, keyInfo]);

  const checks: CheckItem[] | null = useMemo(() => {
    if (!result) return null;
    if (!result.signed) {
      return [
        { key: 'parse', label: 'قراءة الكود', status: 'fail', detail: result.error ?? 'كود غير صالح' },
      ];
    }
    const p = result.signed.payload;
    const list: CheckItem[] = [
      {
        key: 'parse',
        label: 'صيغة الكود وبنية البيانات',
        status: 'pass',
        detail: `PML1 • الإصدار ${p.licenseFormatVersion} • ${p.licenseId}`,
      },
      {
        key: 'sig',
        label: 'التوقيع الرقمي (Ed25519)',
        status: result.signatureValid ? 'pass' : 'fail',
        detail: !keyInfo
          ? 'لا يوجد مفتاح عام للمقارنة — أنشئ المفتاح أولاً'
          : result.signatureValid
            ? 'التوقيع صالح ومطابق للمفتاح العام الحالي'
            : 'التوقيع غير صالح: الكود مزوّر أو معدّل أو صادر بمفتاح آخر',
      },
      {
        key: 'product',
        label: 'معرّف المنتج',
        status: result.productOk ? 'pass' : 'fail',
        detail: `الموجود: ${p.productId} • المتوقع: ${PRODUCT_ID}`,
      },
      {
        key: 'device',
        label: 'الارتباط بالجهاز',
        status:
          expectedInstallationId.trim() || expectedFingerprint.trim()
            ? result.deviceOk
              ? 'pass'
              : 'fail'
            : 'info',
        detail:
          expectedInstallationId.trim() || expectedFingerprint.trim()
            ? result.deviceOk
              ? 'الكود مرتبط بالجهاز المتوقع'
              : 'الكود مرتبط بجهاز مختلف — مرفوض'
            : 'أدخل Installation ID وبصمة الجهاز المتوقعين للتحقق من الارتباط (اختياري)',
      },
      {
        key: 'expiry',
        label: 'الصلاحية الزمنية',
        status: p.licenseType === 'permanent' ? 'pass' : result.expired ? 'fail' : result.expiryOk ? 'pass' : 'fail',
        detail:
          p.licenseType === 'permanent'
            ? 'ترخيص دائم — لا ينتهي'
            : result.expired
              ? `منتهي منذ ${formatDateAr(p.expiresAt!)} — مرفوض`
              : `ساري حتى ${formatDateAr(p.expiresAt!)} (متبقٍ ${daysUntil(p.expiresAt!)} يوم)`,
      },
    ];
    return list;
  }, [result, keyInfo, expectedInstallationId, expectedFingerprint]);

  const onVerify = () => {
    if (!code.trim()) {
      show('الصق كود الترخيص أولاً', 'error');
      return;
    }
    setSubmitted(true);
  };

  const onCopyPayload = async () => {
    if (result?.signed && (await copyText(JSON.stringify(result.signed.payload, null, 2)))) {
      show('تم نسخ بيانات الترخيص', 'success');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { color: c.text }]}>التحقق من ترخيص</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            الصق أي كود ترخيص لفحصه بنفس منطق تطبيق العميل: التوقيع، المنتج، الجهاز، والصلاحية.
          </Text>

          {!keyInfo ? (
            <View style={[styles.keyWarn, { backgroundColor: c.warning + '14', borderColor: c.warning }]}>
              <Ionicons name="warning-outline" size={20} color={c.warning} />
              <Text style={[styles.keyWarnText, { color: c.text }]}>
                لا يوجد مفتاح عام — سيتم فحص البنية فقط دون التحقق من التوقيع.
              </Text>
            </View>
          ) : null}

          <Card>
            <CardTitle icon="qr-code-outline" title="كود الترخيص" />
            <Field
              label="الكود (يبدأ بـ PML1)"
              value={code}
              onChangeText={(t) => {
                setCode(t);
                setSubmitted(false);
              }}
              placeholder="PML1...."
              multiline
              numberOfLines={4}
              mono
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Field
              label="Installation ID المتوقع (اختياري)"
              value={expectedInstallationId}
              onChangeText={(t) => {
                setExpectedInstallationId(t);
                setSubmitted(false);
              }}
              placeholder="لفحص الارتباط بالجهاز"
              autoCapitalize="none"
              autoCorrect={false}
              mono
            />
            <Field
              label="بصمة الجهاز المتوقعة (اختياري)"
              value={expectedFingerprint}
              onChangeText={(t) => {
                setExpectedFingerprint(t);
                setSubmitted(false);
              }}
              placeholder="64 حرف hex"
              autoCapitalize="none"
              autoCorrect={false}
              mono
            />
            <AppButton title="تحقق الآن" icon="shield-checkmark-outline" onPress={onVerify} />
          </Card>

          {result && checks ? (
            <>
              <View
                style={[
                  styles.verdict,
                  { backgroundColor: result.valid ? c.success : c.danger },
                ]}
              >
                <Ionicons
                  name={result.valid ? 'checkmark-circle' : 'close-circle'}
                  size={40}
                  color="#fff"
                />
                <Text style={styles.verdictTitle}>
                  {result.valid ? 'ترخيص صالح ومقبول' : 'ترخيص مرفوض'}
                </Text>
                <Text style={styles.verdictSub}>
                  {result.valid
                    ? 'سيقبله تطبيق العميل على الجهاز المرتبط'
                    : result.error && !result.signed
                      ? result.error
                      : 'راجع الفحوصات أدناه لمعرفة سبب الرفض'}
                </Text>
              </View>

              <Card>
                <CardTitle icon="list-outline" title="نتائج الفحص" />
                <CheckList checks={checks} />
              </Card>

              {result.signed ? (
                <Card>
                  <CardTitle icon="document-text-outline" title="بيانات الترخيص" />
                  <InfoRow label="العميل" value={result.signed.payload.customerName} />
                  <InfoRow label="رقم العميل" value={result.signed.payload.customerNumber} />
                  <InfoRow label="معرّف الترخيص" value={result.signed.payload.licenseId} mono />
                  <InfoRow
                    label="النوع"
                    value={
                      result.signed.payload.licenseType === 'permanent'
                        ? 'دائم'
                        : `مؤقت حتى ${formatDateAr(result.signed.payload.expiresAt!)}`
                    }
                  />
                  <InfoRow label="تاريخ الإصدار" value={formatDateTimeAr(result.signed.payload.issuedAt)} />
                  <InfoRow label="Installation ID" value={result.signed.payload.installationId} mono />
                  <InfoRow label="بصمة الجهاز" value={result.signed.payload.devicePublicKeyFingerprint} mono />
                  <AppButton title="نسخ البيانات (JSON)" variant="ghost" small icon="copy-outline" onPress={onCopyPayload} />
                </Card>
              ) : null}
            </>
          ) : null}

          <Text style={[styles.hint, { color: c.textMuted }]}>
            التحقق عملية قراءة فقط — لا تفعّل أي شيء ولا تعدّل أي سجل.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

void base64Decode;
void hexEncode;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  keyWarn: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 14, alignItems: 'center' },
  keyWarnText: { flex: 1, fontSize: 13, lineHeight: 18 },
  verdict: { borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 14 },
  verdictTitle: { color: '#fff', fontSize: 19, fontWeight: '900', marginTop: 8 },
  verdictSub: { color: '#FFFFFFDD', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 19 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
