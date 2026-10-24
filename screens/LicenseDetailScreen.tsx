import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Card, CardTitle, InfoRow } from '../components/Card';
import { CodeBlock } from '../components/CodeBlock';
import { CheckList } from '../components/CheckList';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { verifyLicenseCode } from '../lib/crypto';
import { revokeLicense } from '../lib/db';
import { base64Decode } from '../lib/helpers';
import { formatDateAr, formatDateTimeAr, daysUntil, groupFingerprint } from '../lib/helpers';
import { buildLicenseMessage, copyText, shareViaWhatsApp } from '../lib/share';
import { userMessage } from '../lib/errors';
import type { CheckItem } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';
import { Alert } from 'react-native';

type Props = NativeStackScreenProps<RootStackParamList, 'LicenseDetail'>;

export function LicenseDetailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { db, setDb, keyInfo } = useAppStore();
  const { toast, show } = useToast();

  const record = db.licenses.find((r) => r.id === route.params.recordId);

  const verification: { checks: CheckItem[]; valid: boolean } | null = useMemo(() => {
    if (!record || !keyInfo) return null;
    const v = verifyLicenseCode(record.code, keyInfo.publicKey);
    const checks: CheckItem[] = [
      {
        key: 'sig',
        label: 'التوقيع الرقمي',
        status: v.signatureValid ? 'pass' : 'fail',
        detail: v.signatureValid ? 'التوقيع صالح ومطابق للمفتاح الحالي' : 'التوقيع غير صالح أو صادر بمفتاح مختلف',
      },
      {
        key: 'product',
        label: 'معرّف المنتج',
        status: v.productOk ? 'pass' : 'fail',
        detail: record.payload.productId,
      },
      {
        key: 'expiry',
        label: 'الصلاحية الزمنية',
        status: v.expired ? 'fail' : 'pass',
        detail:
          record.type === 'permanent'
            ? 'ترخيص دائم — لا ينتهي'
            : v.expired
              ? `انتهى بتاريخ ${formatDateAr(record.expiresAt!)}`
              : `ساري — متبقٍ ${daysUntil(record.expiresAt!)} يوم`,
      },
      {
        key: 'revoked',
        label: 'الحالة الإدارية',
        status: record.revoked ? 'warn' : 'pass',
        detail: record.revoked ? `ملغي إدارياً: ${record.revokedReason}` : 'نشط في السجل الإداري',
      },
    ];
    return { checks, valid: v.valid && !record.revoked };
  }, [record, keyInfo]);

  if (!record) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
        <View style={styles.center}>
          <Text style={{ color: c.text }}>سجل الترخيص غير موجود.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const onCopy = async () => {
    if (await copyText(record.code)) show('تم نسخ كود الترخيص', 'success');
    else show('تعذر النسخ', 'error');
  };

  const onWhatsApp = async () => {
    const res = await shareViaWhatsApp(buildLicenseMessage(record));
    if (res === 'opened') show('تم فتح واتساب — أكمل الإرسال من هناك', 'success');
    else {
      show('تعذر فتح واتساب — تم نسخ الرسالة', 'error');
      await copyText(buildLicenseMessage(record));
    }
  };

  const onReissue = () => {
    Alert.alert(
      'إعادة إصدار الترخيص',
      'سيتم إنشاء سجل ترخيص جديد تماماً (مع الاحتفاظ بهذا السجل للتدقيق). ستحتاج إلى طلب تفعيل جديد من الجهاز الجديد.\n\nما سبب إعادة الإصدار؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تغيير جهاز',
          onPress: () => goReissue('تغيير جهاز العميل'),
        },
        {
          text: 'أسباب أخرى',
          onPress: () => goReissue('إعادة إصدار إدارية'),
        },
      ]
    );
  };

  const goReissue = (reason: string) => {
    (navigation as any).navigate('Main', {
      screen: 'NewLicense',
      params: {
        prefill: {
          customerName: record.customerName,
          customerNumber: record.customerNumber,
          licenseType: record.type,
          durationDays: record.durationDays ? String(record.durationDays) : '30',
          notes: `إعادة إصدار للترخيص ${record.id}. السبب: ${reason}.`,
          reissueOf: record.id,
          reissueReason: reason,
        },
      },
    });
  };

  const onRevoke = () => {
    if (record.revoked) return;
    Alert.alert('إلغاء الترخيص إدارياً', 'سيتم وضع علامة «ملغي» على هذا السجل. لن يؤثر ذلك على نسخة العميل المفعّلة سابقاً، لكنه يمنع إعادة استخدامه إدارياً. هل أنت متأكد؟', [
      { text: 'تراجع', style: 'cancel' },
      {
        text: 'تأكيد الإلغاء',
        style: 'destructive',
        onPress: async () => {
          try {
            const next = await revokeLicense(db, record.id, 'إلغاء إداري من المطوّر');
            setDb(next);
            show('تم إلغاء الترخيص إدارياً', 'success');
          } catch (e) {
            show(userMessage(e), 'error');
          }
        },
      },
    ]);
  };

  const onVerifyFull = () => {
    (navigation as any).navigate('Main', { screen: 'Verify', params: { code: record.code } });
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusBanner, { backgroundColor: record.revoked ? c.danger : c.success }]}>
          <Text style={styles.statusTitle}>
            {record.revoked ? 'ترخيص ملغي إدارياً' : record.type === 'permanent' ? 'ترخيص دائم' : `ترخيص مؤقت — ${record.durationDays} يوم`}
          </Text>
          <Text style={styles.statusSub}>{record.id}</Text>
        </View>

        <Card>
          <CardTitle icon="person-outline" title="العميل والجهاز" />
          <InfoRow label="العميل" value={record.customerName} />
          <InfoRow label="رقم العميل" value={record.customerNumber} />
          <InfoRow label="Installation ID" value={record.installationId} mono />
          <InfoRow label="بصمة الجهاز" value={groupFingerprint(record.fingerprint)} mono />
        </Card>

        <Card>
          <CardTitle icon="time-outline" title="التواريخ" />
          <InfoRow label="تاريخ الإصدار" value={formatDateTimeAr(record.issuedAt)} />
          <InfoRow
            label="تاريخ الانتهاء"
            value={record.expiresAt !== null ? formatDateTimeAr(record.expiresAt) : '— (دائم)'}
          />
          {record.revoked && record.revokedAt ? (
            <InfoRow label="تاريخ الإلغاء" value={formatDateTimeAr(record.revokedAt)} />
          ) : null}
          {record.revokedReason ? <InfoRow label="سبب الإلغاء" value={record.revokedReason} /> : null}
          {record.reissueOf ? <InfoRow label="أُعيد إصداره من" value={record.reissueOf} mono /> : null}
          {record.reissueReason ? <InfoRow label="سبب إعادة الإصدار" value={record.reissueReason} /> : null}
        </Card>

        {record.notes ? (
          <Card>
            <CardTitle icon="pencil-outline" title="الملاحظات الإدارية" />
            <Text style={[styles.notes, { color: c.text }]} selectable>{record.notes}</Text>
          </Card>
        ) : null}

        <Card>
          <CardTitle icon="shield-checkmark-outline" title="التحقق من الترخيص" subtitle={keyInfo ? 'بالمفتاح العام الحالي' : 'المفتاح العام غير متوفر'} />
          {verification ? <CheckList checks={verification.checks} /> : (
            <Text style={{ color: c.textSecondary }}>أنشئ مفتاح التوقيع أولاً لعرض نتيجة التحقق.</Text>
          )}
          <AppButton title="فتح في شاشة التحقق الكاملة" variant="ghost" icon="search-outline" onPress={onVerifyFull} small />
        </Card>

        <Card>
          <CardTitle icon="qr-code-outline" title="كود الترخيص الموقّع" />
          <CodeBlock value={record.code} label="SIGNED LICENSE" maxHeight={180} />
        </Card>

        <AppButton title="نسخ الترخيص" icon="copy-outline" onPress={onCopy} />
        <View style={{ height: 10 }} />
        <AppButton title="مشاركة عبر واتساب" icon="logo-whatsapp" variant="whatsapp" onPress={onWhatsApp} />
        <View style={{ height: 10 }} />
        <View style={styles.twoBtns}>
          <View style={{ flex: 1 }}>
            <AppButton title="إعادة إصدار" icon="refresh-outline" variant="secondary" onPress={onReissue} />
          </View>
          <View style={{ flex: 1 }}>
            <AppButton
              title={record.revoked ? 'ملغي' : 'إلغاء إداري'}
              icon="ban-outline"
              variant="danger"
              onPress={onRevoke}
              disabled={record.revoked}
            />
          </View>
        </View>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          إعادة الإصدار تنشئ سجلاً جديداً ولا تعدّل هذا السجل — التزاماً بسياسة استبدال الأجهزة.
        </Text>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

void base64Decode;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBanner: { borderRadius: 18, padding: 18, marginBottom: 14, alignItems: 'center' },
  statusTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  statusSub: { color: '#FFFFFFCC', fontSize: 12, fontFamily: 'monospace', marginTop: 6 },
  notes: { fontSize: 14, lineHeight: 22 },
  twoBtns: { flexDirection: 'row', gap: 10 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 12, lineHeight: 18 },
});
