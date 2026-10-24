import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { Card, CardTitle } from '../components/Card';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { parseActivationRequest } from '../lib/crypto';
import { issueLicense, type IssueProgress } from '../lib/issue';
import { userMessage } from '../lib/errors';
import { formatDateAr, groupFingerprint, truncateMiddle } from '../lib/helpers';
import type { ActivationRequestInfo } from '../lib/types';
import type { MainTabParamList, RootStackParamList } from '../navigation/types';

type Props = CompositeScreenProps<
  BottomTabScreenProps<MainTabParamList, 'NewLicense'>,
  NativeStackScreenProps<RootStackParamList>
>;

const MAX_REQ = 4000;

export function NewLicenseScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { keyReady, keyInfo, refreshDb } = useAppStore();
  const { toast, show } = useToast();

  const prefill = route.params?.prefill;
  const prefillKey = JSON.stringify(prefill ?? null);
  const [appliedPrefill, setAppliedPrefill] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerNumber, setCustomerNumber] = useState('');
  const [activationRequest, setActivationRequest] = useState('');
  const [licenseType, setLicenseType] = useState<'permanent' | 'temporary'>('temporary');
  const [durationDays, setDurationDays] = useState('30');
  const [notes, setNotes] = useState('');
  const [reissueOf, setReissueOf] = useState<string | null>(null);
  const [reissueReason, setReissueReason] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<IssueProgress | null>(null);

  if (prefill && appliedPrefill !== prefillKey) {
    setAppliedPrefill(prefillKey);
    if (prefill.customerName !== undefined) setCustomerName(prefill.customerName);
    if (prefill.customerNumber !== undefined) setCustomerNumber(prefill.customerNumber);
    if (prefill.activationRequest !== undefined) setActivationRequest(prefill.activationRequest);
    if (prefill.licenseType !== undefined) setLicenseType(prefill.licenseType);
    if (prefill.durationDays !== undefined) setDurationDays(prefill.durationDays);
    if (prefill.notes !== undefined) setNotes(prefill.notes);
    setReissueOf(prefill.reissueOf ?? null);
    setReissueReason(prefill.reissueReason ?? null);
  }

  const parsed: { info: ActivationRequestInfo | null; error: string | null } = useMemo(() => {
    const t = activationRequest.trim();
    if (!t) return { info: null, error: null };
    try {
      return { info: parseActivationRequest(t), error: null };
    } catch (e) {
      return { info: null, error: userMessage(e) };
    }
  }, [activationRequest]);

  const expiryPreview = useMemo(() => {
    if (licenseType !== 'temporary') return null;
    const n = Number(durationDays.trim());
    if (!Number.isInteger(n) || n <= 0 || n > 36500) return null;
    return formatDateAr(Date.now() + n * 86400000);
  }, [licenseType, durationDays]);

  const canSubmit =
    !busy &&
    keyReady &&
    customerName.trim().length > 0 &&
    customerNumber.trim().length > 0 &&
    parsed.info !== null &&
    (licenseType === 'permanent' || expiryPreview !== null);

  const onSubmit = async () => {
    if (!keyReady) {
      Alert.alert(
        'لا يمكن إصدار الترخيص',
        'مفتاح التوقيع غير موجود أو تالف. أنشئ المفتاح من شاشة الإعداد أولاً.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'الإعداد', onPress: () => (navigation as any).navigate('SetupKey') },
        ]
      );
      return;
    }
    if (!parsed.info) {
      show('طلب التفعيل غير صالح — راجع الخطأ أعلاه', 'error');
      return;
    }
    setBusy(true);
    setProgress({ step: 0, total: 7, label: 'بدء الإصدار...' });
    try {
      const { record } = await issueLicense(
        {
          customerName,
          customerNumber,
          activationRequest,
          licenseType,
          durationDays,
          notes,
          reissueOf,
          reissueReason,
        },
        (p) => setProgress(p)
      );
      await refreshDb();
      show('تم توليد الترخيص وتوقيعه بنجاح', 'success');
      // reset form
      setCustomerName('');
      setCustomerNumber('');
      setActivationRequest('');
      setLicenseType('temporary');
      setDurationDays('30');
      setNotes('');
      setReissueOf(null);
      setReissueReason(null);
      navigation.navigate('LicenseResult' as any, { recordId: record.id } as any);
    } catch (e) {
      show(userMessage(e), 'error');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const typeLabel = licenseType === 'permanent' ? 'دائم — بدون تاريخ انتهاء' : `مؤقت — ${durationDays || '?'} يوم`;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.h1, { color: c.text }]}>ترخيص جديد</Text>
          <Text style={[styles.sub, { color: c.textSecondary }]}>
            أدخل بيانات العميل والصق طلب التفعيل، ثم اضغط «توليد الترخيص».
          </Text>

          {!keyReady ? (
            <View style={[styles.keyWarn, { backgroundColor: c.danger + '14', borderColor: c.danger }]}>
              <Ionicons name="key-outline" size={22} color={c.danger} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.keyWarnTitle, { color: c.danger }]}>مفتاح التوقيع غير جاهز</Text>
                <Text style={[styles.keyWarnSub, { color: c.textSecondary }]}>
                  لن تتمكن من إصدار التراخيص حتى تنشئ المفتاح أو تستعيده.
                </Text>
                <AppButton
                  title="الذهاب إلى الإعداد"
                  small
                  onPress={() => (navigation as any).navigate('SetupKey')}
                  style={{ marginTop: 8, alignSelf: 'flex-start', paddingHorizontal: 16 }}
                />
              </View>
            </View>
          ) : (
            <View style={[styles.keyOk, { backgroundColor: c.primarySoft, borderColor: c.primary }]}>
              <Ionicons name="shield-checkmark" size={18} color={c.primary} />
              <Text style={[styles.keyOkText, { color: c.primary }]} numberOfLines={1}>
                التوقيع بمفتاح: {keyInfo ? truncateMiddle(keyInfo.fingerprint, 8, 6) : '...'}
              </Text>
            </View>
          )}

          {reissueOf ? (
            <View style={[styles.keyOk, { backgroundColor: c.info + '14', borderColor: c.info }]}>
              <Ionicons name="refresh-circle" size={18} color={c.info} />
              <Text style={[styles.keyOkText, { color: c.info, flex: 1 }]} numberOfLines={2}>
                إعادة إصدار للترخيص {reissueOf}
                {reissueReason ? ` — السبب: ${reissueReason}` : ''}
              </Text>
            </View>
          ) : null}

          <Card>
            <CardTitle icon="person-outline" title="بيانات العميل" />
            <Field
              label="اسم العميل / المنشأة *"
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="مثال: مزرعة النور للدواجن"
              returnKeyType="next"
            />
            <Field
              label="رقم العميل *"
              value={customerNumber}
              onChangeText={setCustomerNumber}
              placeholder="مثال: C-1042"
              autoCapitalize="characters"
              returnKeyType="next"
              hint="يُحفظ في قاعدة العملاء ويُستخدم للبحث والتعريف."
            />
          </Card>

          <Card>
            <CardTitle icon="qr-code-outline" title="طلب التفعيل" subtitle="الصق الطلب المرسل من تطبيق العميل (يبدأ بـ PMAR1)" />
            <Field
              label="نص طلب التفعيل *"
              value={activationRequest}
              onChangeText={(t) => setActivationRequest(t.slice(0, MAX_REQ))}
              placeholder="PMAR1...."
              multiline
              numberOfLines={4}
              mono
              autoCapitalize="none"
              autoCorrect={false}
              hint={`${activationRequest.length} / ${MAX_REQ} حرف`}
            />
            {parsed.error ? (
              <View style={[styles.parseBox, { backgroundColor: c.danger + '12', borderColor: c.danger }]}>
                <Ionicons name="close-circle" size={20} color={c.danger} />
                <Text style={[styles.parseText, { color: c.danger }]}>{parsed.error}</Text>
              </View>
            ) : null}
            {parsed.info ? (
              <View style={[styles.parseBox, { backgroundColor: c.success + '12', borderColor: c.success }]}>
                <Ionicons name="checkmark-circle" size={20} color={c.success} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.parseTitle, { color: c.success }]}>طلب تفعيل صالح</Text>
                  <Text style={[styles.parseText, { color: c.text }]} selectable>
                    Installation ID: {parsed.info.installationId}
                  </Text>
                  <Text style={[styles.parseTextMono, { color: c.text }]} selectable>
                    Fingerprint: {groupFingerprint(parsed.info.fingerprint)}
                  </Text>
                </View>
              </View>
            ) : null}
          </Card>

          <Card>
            <CardTitle icon="document-text-outline" title="نوع الترخيص والمدة" />
            <View style={styles.typeRow}>
              <Pressable
                onPress={() => setLicenseType('temporary')}
                style={[
                  styles.typeBtn,
                  {
                    borderColor: licenseType === 'temporary' ? c.primary : c.border,
                    backgroundColor: licenseType === 'temporary' ? c.primarySoft : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name="time-outline"
                  size={22}
                  color={licenseType === 'temporary' ? c.primary : c.textMuted}
                />
                <Text style={[styles.typeTitle, { color: licenseType === 'temporary' ? c.primary : c.text }]}>
                  مؤقت
                </Text>
                <Text style={[styles.typeSub, { color: c.textSecondary }]}>مدة مخصصة بالأيام</Text>
              </Pressable>
              <Pressable
                onPress={() => setLicenseType('permanent')}
                style={[
                  styles.typeBtn,
                  {
                    borderColor: licenseType === 'permanent' ? c.primary : c.border,
                    backgroundColor: licenseType === 'permanent' ? c.primarySoft : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name="infinite-outline"
                  size={22}
                  color={licenseType === 'permanent' ? c.primary : c.textMuted}
                />
                <Text style={[styles.typeTitle, { color: licenseType === 'permanent' ? c.primary : c.text }]}>
                  دائم
                </Text>
                <Text style={[styles.typeSub, { color: c.textSecondary }]}>بدون انتهاء</Text>
              </Pressable>
            </View>

            {licenseType === 'temporary' ? (
              <>
                <Field
                  label="مدة الترخيص بالأيام *"
                  value={durationDays}
                  onChangeText={setDurationDays}
                  placeholder="مثال: 15 أو 45 أو 500"
                  keyboardType="number-pad"
                  returnKeyType="done"
                  hint="أي عدد صحيح موجب (1 - 36500). لا توجد خيارات محددة مسبقاً."
                />
                <View style={[styles.expiryBox, { backgroundColor: c.background, borderColor: c.border }]}>
                  <Ionicons name="calendar-outline" size={18} color={c.textSecondary} />
                  <Text style={[styles.expiryText, { color: expiryPreview ? c.text : c.danger }]}>
                    {expiryPreview ? `تاريخ الانتهاء المتوقع: ${expiryPreview}` : 'أدخل مدة صحيحة لعرض تاريخ الانتهاء'}
                  </Text>
                </View>
              </>
            ) : (
              <View style={[styles.expiryBox, { backgroundColor: c.background, borderColor: c.border }]}>
                <Ionicons name="infinite-outline" size={18} color={c.textSecondary} />
                <Text style={[styles.expiryText, { color: c.text }]}>تاريخ الإصدار: اليوم — بدون تاريخ انتهاء</Text>
              </View>
            )}
          </Card>

          <Card>
            <CardTitle icon="pencil-outline" title="ملاحظات إدارية" subtitle="داخلية فقط — لا تدخل في الترخيص الموقّع" />
            <Field
              label="ملاحظات"
              value={notes}
              onChangeText={setNotes}
              placeholder="حالة الدفع، سبب الإصدار، تفاصيل التجديد..."
              multiline
              numberOfLines={3}
            />
          </Card>

          <Text style={[styles.summary, { color: c.textSecondary }]}>
            الملخص: {customerName.trim() || '—'} ({customerNumber.trim() || '—'}) — {typeLabel}
          </Text>

          {busy && progress ? (
            <View style={[styles.progressBox, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={[styles.progressLabel, { color: c.text }]}>{progress.label}...</Text>
              <View style={[styles.progressTrack, { backgroundColor: c.border }]}>
                <View
                  style={[
                    styles.progressFill,
                    { backgroundColor: c.primary, width: `${Math.round((progress.step / progress.total) * 100)}%` },
                  ]}
                />
              </View>
              <Text style={[styles.progressStep, { color: c.textMuted }]}>
                الخطوة {progress.step} من {progress.total}
              </Text>
            </View>
          ) : null}

          <AppButton
            title="توليد الترخيص"
            icon="key"
            onPress={onSubmit}
            disabled={!canSubmit}
            loading={busy}
            style={styles.submit}
          />
          {!canSubmit && !busy ? (
            <Text style={[styles.disabledHint, { color: c.textMuted }]}>
              {!keyReady
                ? 'أنشئ مفتاح التوقيع أولاً'
                : !parsed.info
                  ? 'الصق طلب تفعيل صالحاً للمتابعة'
                  : 'أكمل الحقول المطلوبة (*) للمتابعة'}
            </Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  keyWarn: { flexDirection: 'row', gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14, marginBottom: 14 },
  keyWarnTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  keyWarnSub: { fontSize: 13, lineHeight: 19 },
  keyOk: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 14 },
  keyOkText: { fontSize: 12.5, fontWeight: '700' },
  parseBox: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  parseTitle: { fontSize: 13.5, fontWeight: '800', marginBottom: 4 },
  parseText: { fontSize: 13, lineHeight: 19 },
  parseTextMono: { fontSize: 11.5, lineHeight: 18, fontFamily: 'monospace', marginTop: 2 },
  typeRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  typeTitle: { fontSize: 16, fontWeight: '800' },
  typeSub: { fontSize: 12 },
  expiryBox: { flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12 },
  expiryText: { fontSize: 13, fontWeight: '700', flex: 1 },
  summary: { fontSize: 13, textAlign: 'center', marginBottom: 12, lineHeight: 19 },
  progressBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  progressLabel: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  progressStep: { fontSize: 12, marginTop: 6, textAlign: 'center' },
  submit: { marginTop: 2 },
  disabledHint: { fontSize: 12.5, textAlign: 'center', marginTop: 8 },
});
