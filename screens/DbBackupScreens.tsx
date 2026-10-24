import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import {
  exportEncryptedDbBackup,
  decryptDbBackup,
  mergeRestore,
  replaceDb,
  type RestorePreview,
} from '../lib/db';
import { copyText } from '../lib/share';
import { formatDateTimeAr } from '../lib/helpers';
import { userMessage } from '../lib/errors';
import type { DbSchema } from '../lib/types';
import type { RootStackParamList } from '../navigation/types';

export function DbBackupScreen(_: NativeStackScreenProps<RootStackParamList, 'DbBackup'>) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { db } = useAppStore();
  const { toast, show } = useToast();
  const [password, setPassword] = useState('');
  const [backup, setBackup] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onExport = async () => {
    setBusy(true);
    try {
      const b = await exportEncryptedDbBackup(db, password);
      setBackup(b);
      show(`تم تصدير ${db.licenses.length} ترخيص و${db.customers.length} عميل مشفّراً`, 'success');
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
        <Text style={[styles.h1, { color: c.text }]}>نسخة احتياطية للسجلات</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          تصدير مشفّر لكامل قاعدة البيانات الإدارية (التراخيص، العملاء، الملاحظات).
        </Text>
        <Card>
          <CardTitle
            icon="server-outline"
            title="محتوى النسخة"
            subtitle={`${db.licenses.length} ترخيص • ${db.customers.length} عميل`}
          />
          {!backup ? (
            <>
              <Field
                label="كلمة مرور النسخة (8 أحرف على الأقل)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="كلمة مرور قوية"
                returnKeyType="done"
                onSubmitEditing={onExport}
              />
              <AppButton title="إنشاء النسخة المشفرة" icon="lock-closed" onPress={onExport} loading={busy} />
            </>
          ) : (
            <>
              <CodeBlock value={backup} label="DATABASE BACKUP (PMDB1)" />
              <AppButton title="نسخ النسخة" icon="copy-outline" onPress={onCopy} variant="secondary" />
              <AppButton title="إنشاء نسخة جديدة" variant="ghost" onPress={() => { setBackup(null); setPassword(''); }} />
            </>
          )}
        </Card>
      </ScrollView>
      <Toast visible={toast.visible} message={toast.message} kind={toast.kind} />
    </SafeAreaView>
  );
}

export function DbRestoreScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'DbRestore'>) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { db, setDb } = useAppStore();
  const { toast, show } = useToast();
  const [backup, setBackup] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ preview: RestorePreview; data: DbSchema } | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');

  const onDecrypt = async () => {
    setBusy(true);
    try {
      const { db: restored, preview: pv } = await decryptDbBackup(backup, password);
      setPreview({ preview: pv, data: restored });
      show('تم فك التشفير والتحقق من السلامة', 'success');
    } catch (e) {
      show(userMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const onApply = () => {
    if (!preview) return;
    const isReplace = mode === 'replace';
    Alert.alert(
      isReplace ? 'استبدال كامل للبيانات؟' : 'دمج النسخة مع البيانات الحالية؟',
      isReplace
        ? `سيتم استبدال ${db.licenses.length} سجلاً حالياً بـ ${preview.preview.licenses} سجلاً من النسخة. لا يمكن التراجع.`
        : `سيتم إضافة السجلات المفقودة فقط من النسخة (${preview.preview.licenses} ترخيص) مع الاحتفاظ بكل السجلات الحالية (${db.licenses.length}). السجلات الموجودة لن تُعدّل.`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: isReplace ? 'استبدال' : 'دمج',
          style: isReplace ? 'destructive' : 'default',
          onPress: async () => {
            try {
              if (isReplace) {
                await replaceDb(preview.data);
                setDb({ ...preview.data, updatedAt: Date.now() });
              } else {
                const merged = mergeRestore(db, preview.data);
                await replaceDb(merged);
                setDb(merged);
              }
              show(isReplace ? 'تم استبدال البيانات بنجاح' : 'تم دمج النسخة بنجاح', 'success');
              setTimeout(() => navigation.goBack(), 800);
            } catch (e) {
              show(userMessage(e), 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[styles.h1, { color: c.text }]}>استعادة السجلات</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          فك تشفير نسخة PMDB1 مع التحقق من السلامة، ثم دمجها أو استبدال البيانات بها.
        </Text>

        {!preview ? (
          <Card>
            <CardTitle icon="cloud-upload-outline" title="بيانات الاستعادة" />
            <Field
              label="نص النسخة الاحتياطية (PMDB1...)"
              value={backup}
              onChangeText={setBackup}
              placeholder="PMDB1...."
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
              onSubmitEditing={onDecrypt}
            />
            <AppButton
              title="فك التشفير والمعاينة"
              icon="lock-open-outline"
              onPress={onDecrypt}
              loading={busy}
              disabled={!backup.trim() || !password}
            />
          </Card>
        ) : (
          <>
            <Card>
              <CardTitle icon="checkmark-circle-outline" title="النسخة سليمة — المعاينة" />
              <View style={styles.previewGrid}>
                <View style={[styles.previewItem, { backgroundColor: c.background }]}>
                  <Text style={[styles.previewNum, { color: c.text }]}>{preview.preview.licenses}</Text>
                  <Text style={[styles.previewLabel, { color: c.textSecondary }]}>ترخيص</Text>
                </View>
                <View style={[styles.previewItem, { backgroundColor: c.background }]}>
                  <Text style={[styles.previewNum, { color: c.text }]}>{preview.preview.customers}</Text>
                  <Text style={[styles.previewLabel, { color: c.textSecondary }]}>عميل</Text>
                </View>
              </View>
              {preview.preview.exportedAt > 0 ? (
                <Text style={[styles.exportedAt, { color: c.textSecondary }]}>
                  تاريخ التصدير: {formatDateTimeAr(preview.preview.exportedAt)}
                </Text>
              ) : null}
              <Text style={[styles.current, { color: c.textSecondary }]}>
                البيانات الحالية: {db.licenses.length} ترخيص • {db.customers.length} عميل
              </Text>
            </Card>

            <Card>
              <CardTitle icon="git-merge-outline" title="طريقة الاستعادة" />
              <Pressable
                onPress={() => setMode('merge')}
                style={[styles.modeBtn, { borderColor: mode === 'merge' ? c.success : c.border, backgroundColor: mode === 'merge' ? c.success + '12' : 'transparent' }]}
              >
                <Ionicons name={mode === 'merge' ? 'radio-button-on' : 'radio-button-off'} size={20} color={mode === 'merge' ? c.success : c.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: c.text }]}>دمج آمن (موصى به)</Text>
                  <Text style={[styles.modeSub, { color: c.textSecondary }]}>إضافة المفقود فقط — لا تعديل ولا حذف للسجلات الحالية</Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => setMode('replace')}
                style={[styles.modeBtn, { borderColor: mode === 'replace' ? c.danger : c.border, backgroundColor: mode === 'replace' ? c.danger + '12' : 'transparent' }]}
              >
                <Ionicons name={mode === 'replace' ? 'radio-button-on' : 'radio-button-off'} size={20} color={mode === 'replace' ? c.danger : c.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modeTitle, { color: c.text }]}>استبدال كامل</Text>
                  <Text style={[styles.modeSub, { color: c.textSecondary }]}>حذف البيانات الحالية واستبدالها بالنسخة</Text>
                </View>
              </Pressable>
              <View style={{ height: 10 }} />
              <AppButton
                title={mode === 'merge' ? 'تنفيذ الدمج' : 'تنفيذ الاستبدال'}
                icon="checkmark"
                variant={mode === 'merge' ? 'primary' : 'danger'}
                onPress={onApply}
              />
              <AppButton title="استعادة نسخة أخرى" variant="ghost" onPress={() => { setPreview(null); setBackup(''); setPassword(''); }} />
            </Card>
          </>
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
  previewGrid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  previewItem: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  previewNum: { fontSize: 26, fontWeight: '900' },
  previewLabel: { fontSize: 13, marginTop: 2 },
  exportedAt: { fontSize: 12.5, textAlign: 'center', marginBottom: 4 },
  current: { fontSize: 12.5, textAlign: 'center' },
  modeBtn: { flexDirection: 'row', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 8, alignItems: 'flex-start' },
  modeTitle: { fontSize: 15, fontWeight: '800' },
  modeSub: { fontSize: 12.5, marginTop: 2, lineHeight: 18 },
});
