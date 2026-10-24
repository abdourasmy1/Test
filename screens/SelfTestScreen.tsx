import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Card, CardTitle } from '../components/Card';
import { Toast, useToast } from '../components/Toast';
import { runSelfTests, formatTestReport } from '../lib/selftest';
import { LAST_REPORT_KEY } from '../lib/settings';
import { copyText, shareViaWhatsApp } from '../lib/share';
import type { SelfTestReport } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';

export function SelfTestScreen(_: NativeStackScreenProps<RootStackParamList, 'SelfTest'>) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { toast, show } = useToast();
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<SelfTestReport | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAST_REPORT_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setReport(JSON.parse(raw));
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {});
  }, []);

  const onRun = async () => {
    setRunning(true);
    try {
      // let the UI paint the spinner first
      await new Promise((r) => setTimeout(r, 60));
      const rep = await runSelfTests();
      setReport(rep);
      await AsyncStorage.setItem(LAST_REPORT_KEY, JSON.stringify(rep));
      show(
        rep.failed === 0 ? `نجحت جميع الاختبارات (${rep.passed}/${rep.results.length})` : `فشل ${rep.failed} من ${rep.results.length} — راجع التفاصيل`,
        rep.failed === 0 ? 'success' : 'error'
      );
    } finally {
      setRunning(false);
    }
  };

  const onCopy = async () => {
    if (report && (await copyText(formatTestReport(report)))) show('تم نسخ التقرير', 'success');
    else show('لا يوجد تقرير بعد', 'error');
  };

  const onShare = async () => {
    if (!report) {
      show('لا يوجد تقرير بعد', 'error');
      return;
    }
    const res = await shareViaWhatsApp(formatTestReport(report));
    if (res !== 'opened') {
      await copyText(formatTestReport(report));
      show('تعذر فتح واتساب — تم نسخ التقرير', 'error');
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: c.text }]}>الاختبار الذاتي</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          16 فحصاً حقيقياً تُنفَّذ فعلياً على هذا الجهاز: التوقيع، التحقق، الرفض، المدد، والنسخ —
          بمفاتيح مؤقتة لا تمس مفتاحك الحقيقي أو بياناتك.
        </Text>

        <AppButton
          title={running ? 'جارٍ تنفيذ الاختبارات...' : report ? 'إعادة تنفيذ الاختبارات' : 'تنفيذ الاختبارات الآن'}
          icon="play"
          onPress={onRun}
          loading={running}
        />

        {running ? (
          <View style={styles.runningBox}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={[styles.runningText, { color: c.textSecondary }]}>تنفيذ التوقيع والتحقق الحقيقي...</Text>
          </View>
        ) : null}

        {report && !running ? (
          <>
            <View style={[styles.summary, { backgroundColor: report.failed === 0 ? c.success : c.danger }]}>
              <Ionicons name={report.failed === 0 ? 'checkmark-done-circle' : 'warning'} size={40} color="#fff" />
              <Text style={styles.summaryTitle}>
                {report.passed} ناجح / {report.failed} فاشل
              </Text>
              <Text style={styles.summarySub}>
                من أصل {report.results.length} اختباراً • {new Date(report.ranAt).toLocaleString('en-GB')}
              </Text>
            </View>

            <Card>
              <CardTitle icon="list-outline" title="نتائج الاختبارات" />
              {report.results.map((r) => (
                <View key={r.id} style={[styles.caseRow, { borderBottomColor: c.border }]}>
                  <Ionicons
                    name={r.passed ? 'checkmark-circle' : 'close-circle'}
                    size={22}
                    color={r.passed ? c.success : c.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.caseTitle, { color: c.text }]}>
                      [{r.id}] {r.title}
                    </Text>
                    {!r.passed ? <Text style={[styles.caseDetail, { color: c.danger }]}>{r.detail}</Text> : null}
                  </View>
                  <Text style={[styles.caseMs, { color: c.textMuted }]}>{r.durationMs}ms</Text>
                </View>
              ))}
            </Card>

            <View style={styles.btnRow}>
              <View style={{ flex: 1 }}>
                <AppButton title="نسخ التقرير" icon="copy-outline" variant="secondary" onPress={onCopy} small />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton title="واتساب" icon="logo-whatsapp" variant="whatsapp" onPress={onShare} small />
              </View>
            </View>
          </>
        ) : null}

        <Text style={[styles.hint, { color: c.textMuted }]}>
          تقرير صادق: يعرض فقط ما نُفّذ فعلاً. أي اختبار لم يُنفَّذ لن يظهر كناجح أبداً.
        </Text>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  h1: { fontSize: 22, fontWeight: '900', marginBottom: 4 },
  sub: { fontSize: 14, marginBottom: 14, lineHeight: 21 },
  runningBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  runningText: { fontSize: 14 },
  summary: { borderRadius: 18, padding: 20, alignItems: 'center', marginTop: 14, marginBottom: 14 },
  summaryTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 8 },
  summarySub: { color: '#FFFFFFDD', fontSize: 12.5, marginTop: 4 },
  caseRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 9, borderBottomWidth: 1 },
  caseTitle: { fontSize: 13.5, fontWeight: '700', lineHeight: 19 },
  caseDetail: { fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  caseMs: { fontSize: 11, fontFamily: 'monospace' },
  btnRow: { flexDirection: 'row', gap: 10 },
  hint: { fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 18 },
});
