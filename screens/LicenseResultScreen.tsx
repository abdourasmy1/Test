import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Card, CardTitle, InfoRow } from '../components/Card';
import { CodeBlock } from '../components/CodeBlock';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { formatDateAr } from '../lib/helpers';
import { buildLicenseMessage, copyText, shareViaWhatsApp } from '../lib/share';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'LicenseResult'>;

export function LicenseResultScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { db } = useAppStore();
  const { toast, show } = useToast();
  const [sharing, setSharing] = useState(false);

  const record = db.licenses.find((r) => r.id === route.params.recordId);
  if (!record) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
        <View style={styles.center}>
          <Text style={{ color: c.text }}>سجل الترخيص غير موجود.</Text>
          <AppButton title="رجوع" onPress={() => navigation.goBack()} style={{ marginTop: 12 }} />
        </View>
      </SafeAreaView>
    );
  }

  const onCopy = async () => {
    if (await copyText(record.code)) show('تم نسخ كود الترخيص', 'success');
    else show('تعذر النسخ', 'error');
  };

  const onWhatsApp = async () => {
    setSharing(true);
    try {
      const res = await shareViaWhatsApp(buildLicenseMessage(record));
      if (res === 'opened') show('تم فتح واتساب — أكمل الإرسال من هناك', 'success');
      else {
        show('تعذر فتح واتساب — انسخ الكود وأرسله يدوياً', 'error');
        await copyText(buildLicenseMessage(record));
      }
    } finally {
      setSharing(false);
    }
  };

  const onCopyMessage = async () => {
    if (await copyText(buildLicenseMessage(record))) show('تم نسخ رسالة الترخيص كاملة', 'success');
    else show('تعذر النسخ', 'error');
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.successBanner, { backgroundColor: c.success }]}>
          <Ionicons name="checkmark-circle" size={44} color="#fff" />
          <Text style={styles.successTitle}>تم توليد الترخيص وتوقيعه</Text>
          <Text style={styles.successSub}>تم التحقق من التوقيع ذاتياً وحفظ السجل في قاعدة البيانات</Text>
        </View>

        <Card>
          <CardTitle icon="person-outline" title="بيانات الترخيص" />
          <InfoRow label="العميل" value={record.customerName} />
          <InfoRow label="رقم العميل" value={record.customerNumber} />
          <InfoRow label="معرّف الترخيص" value={record.id} mono />
          <InfoRow label="النوع" value={record.type === 'permanent' ? 'دائم' : `مؤقت (${record.durationDays} يوم)`} />
          <InfoRow label="تاريخ الإصدار" value={formatDateAr(record.issuedAt)} />
          {record.expiresAt !== null ? (
            <InfoRow label="تاريخ الانتهاء" value={formatDateAr(record.expiresAt)} />
          ) : null}
          <InfoRow label="Installation ID" value={record.installationId} mono />
          {record.reissueOf ? <InfoRow label="إعادة إصدار لـ" value={record.reissueOf} mono /> : null}
        </Card>

        <Card>
          <CardTitle icon="qr-code-outline" title="كود الترخيص الموقّع" subtitle="هذا هو الكود الفعلي الذي يتحقق منه تطبيق العميل" />
          <CodeBlock value={record.code} label="SIGNED LICENSE" maxHeight={220} />
        </Card>

        <AppButton title="نسخ الترخيص" icon="copy-outline" onPress={onCopy} />
        <View style={{ height: 10 }} />
        <AppButton title="مشاركة عبر واتساب" icon="logo-whatsapp" variant="whatsapp" onPress={onWhatsApp} loading={sharing} />
        <View style={{ height: 10 }} />
        <AppButton title="نسخ رسالة الترخيص كاملة" icon="chatbox-outline" variant="secondary" onPress={onCopyMessage} />
        <Text style={[styles.note, { color: c.textMuted }]}>
          ملاحظة: فتح واتساب لا يعني إتمام الإرسال — تأكد من إرسال الرسالة من داخل التطبيق.
        </Text>
        <View style={{ height: 6 }} />
        <AppButton
          title="توليد ترخيص آخر"
          icon="add-circle-outline"
          variant="ghost"
          onPress={() => navigation.replace('Main' as any, { screen: 'NewLicense' } as any)}
        />
        <AppButton
          title="عرض السجل الكامل"
          icon="document-text-outline"
          variant="ghost"
          onPress={() => navigation.replace('LicenseDetail', { recordId: record.id })}
        />
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successBanner: { borderRadius: 18, padding: 20, alignItems: 'center', marginBottom: 14 },
  successTitle: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 8 },
  successSub: { color: '#E4F5EA', fontSize: 12.5, textAlign: 'center', marginTop: 6, lineHeight: 18 },
  note: { fontSize: 12, textAlign: 'center', marginTop: 10, lineHeight: 18 },
});
