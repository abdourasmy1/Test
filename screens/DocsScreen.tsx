import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../components/ThemeContext';
import { AppButton } from '../components/AppButton';
import { Card, CardTitle } from '../components/Card';
import { CodeBlock } from '../components/CodeBlock';
import { Toast, useToast } from '../components/Toast';
import { useAppStore } from '../store/appContext';
import { customerAppPublicKeySnippet } from '../lib/keystore';
import { copyText } from '../lib/share';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Docs'>;

const SECTIONS = [
  { key: 'overview', title: 'نظرة عامة على النظام', icon: 'map-outline' },
  { key: 'activation', title: 'صيغة طلب التفعيل (PMAR1)', icon: 'qr-code-outline' },
  { key: 'license', title: 'صيغة الترخيص (PML1)', icon: 'document-text-outline' },
  { key: 'signing', title: 'التوقيع والتحقق', icon: 'key-outline' },
  { key: 'customer', title: 'خطوات الدمج في تطبيق العميل', icon: 'phone-portrait-outline' },
  { key: 'policy', title: 'سياسة استبدال الأجهزة', icon: 'refresh-circle-outline' },
  { key: 'security', title: 'الأمان والقيود الصادقة', icon: 'shield-outline' },
  { key: 'backup', title: 'النسخ الاحتياطي والاستعادة', icon: 'save-outline' },
];

export function DocsScreen({ route }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const { keyInfo } = useAppStore();
  const { toast, show } = useToast();
  const [open, setOpen] = useState<string | null>(route.params?.section ?? 'overview');

  const toggle = (k: string) => setOpen(open === k ? null : k);

  const onCopySnippet = async () => {
    if (!keyInfo) {
      show('لا يوجد مفتاح بعد', 'error');
      return;
    }
    if (await copyText(customerAppPublicKeySnippet(keyInfo))) show('تم نسخ كتلة المفتاح العام', 'success');
    else show('تعذر النسخ', 'error');
  };

  const P = ({ children }: { children: React.ReactNode }) => (
    <Text style={[styles.p, { color: c.text }]}>{children}</Text>
  );

  const renderBody = (key: string) => {
    switch (key) {
      case 'overview':
        return (
          <>
            <P>
              يتكون النظام من تطبيقين منفصلين: (1) تطبيق العميل Poultry Manager الذي يحتاج تفعيلاً، و(2)
              تطبيق مدير التراخيص هذا (للمطوّر فقط). لا يوجد خادم — الثقة مبنية على توقيع رقمي Ed25519:
              المطوّر يوقّع، وتطبيق العميل يتحقق بالمفتاح العام المدمج فيه.
            </P>
            <P>
              الدورة الكاملة: العميل يولّد «طلب تفعيل» من جهازه ← يرسله للمطوّر ← المطوّر يولّد «ترخيصاً
              موقّعاً» مرتبطاً بذلك الجهاز ← العميل يدخل الكود في التطبيق ← التطبيق يتحقق ويُفعّل.
            </P>
          </>
        );
      case 'activation':
        return (
          <>
            <P>طلب التفعيل نص بسطر واحد يولّده تطبيق العميل:</P>
            <CodeBlock value="PMAR1.<base64url(JSON)>" label="FORMAT" copyable={false} />
            <P>محتوى الـ JSON (بدون مسافات زائدة):</P>
            <CodeBlock
              value={'{\n  "v": 1,\n  "installationId": "A1B2C3D4-E5F6...",\n  "devicePublicKey": "<base64url: 32 bytes>",\n  "issuedAt": 1761091200000\n}'}
              label="JSON"
            />
            <P>
              • installationId: نص 8-64 حرف (أحرف/أرقام/_/-).{'\n'}
              • devicePublicKey: مفتاح Ed25519 العام للجهاز (32 بايت، يُفضّل توليده في Android Keystore).{'\n'}
              • البصمة = أول 32 بايت من SHA-512 للمفتاح العام بصيغة hex (64 حرفاً).
            </P>
          </>
        );
      case 'license':
        return (
          <>
            <P>كود الترخيص الموقّع من ثلاثة مقاطع:</P>
            <CodeBlock value="PML1.<base64url(canonicalPayload)>.<base64url(signature)>" label="FORMAT" copyable={false} />
            <P>الحمولة القانونية (canonical JSON بترتيب مفاتيح ثابت — لا تغيّره أبداً):</P>
            <CodeBlock
              value={'{\n  "productId": "poultry-manager-app",\n  "licenseFormatVersion": 1,\n  "licenseId": "LIC-...-...",\n  "customerName": "...",\n  "customerNumber": "...",\n  "installationId": "...",\n  "devicePublicKeyFingerprint": "<64 hex>",\n  "licenseType": "permanent | temporary",\n  "issuedAt": 1761091200000,\n  "expiresAt": 1763683200000,\n  "signatureAlgorithm": "Ed25519"\n}'}
              label="PAYLOAD"
            />
            <P>
              • التوقيع = Ed25519 على بايتات الـ UTF-8 للحمولة القانونية تماماً كما هي.{'\n'}
              • التراخيص الدائمة: expiresAt تساوي null (وليس رقماً).{'\n'}
              • الملاحظات الإدارية لا تدخل في التوقيع أبداً.
            </P>
          </>
        );
      case 'signing':
        return (
          <>
            <P>
              الخوارزمية: Ed25519 (توقيعات 64 بايت، مفاتيح عامة 32 بايت). المفتاح الخاص يُولّد بعشوائية
              آمنة ويُحفظ في التخزين الآمن للجهاز فقط (Android Keystore عبر EncryptedSharedPreferences /
              iOS Keychain) — ولا يظهر على الشاشة ولا يُصدَّر إلا مشفّراً بكلمة مرور.
            </P>
            <P>
              التحقق في تطبيق العميل: فك المقاطع الثلاثة ← إعادة بناء الحمولة القانونية بنفس ترتيب
              المفاتيح ← التحقق من التوقيع المنفصل بالمفتاح العام المدمج ← مطابقة productId ← مطابقة
              الجهاز ← فحص الصلاحية الزمنية. أي خطوة تفشل = رفض الترخيص.
            </P>
            {keyInfo ? (
              <>
                <P>المفتاح العام الحالي (الصقه في كود تطبيق العميل):</P>
                <CodeBlock value={customerAppPublicKeySnippet(keyInfo)} label="CUSTOMER APP SNIPPET" />
                <AppButton title="نسخ كتلة الدمج" icon="copy-outline" small variant="secondary" onPress={onCopySnippet} />
              </>
            ) : (
              <P>لا يوجد مفتاح بعد — أنشئ المفتاح أولاً ثم انسخ المفتاح العام من هنا.</P>
            )}
          </>
        );
      case 'customer':
        return (
          <>
            <P>
              1. عند أول تشغيل: ولّد زوج مفاتيح Ed25519 للجهاز (في Android Keystore إن أمكن) ومعرّف تثبيت
              فريداً، واعرض «طلب التفعيل» PMAR1 مع زر نسخ وزر مشاركة واتساب.{'\n'}
              2. شاشة إدخال الترخيص: حقل لصق الكود PML1 + زر «تفعيل».{'\n'}
              3. عند الضغط: فكّ الكود، تحقق من التوقيع بالمفتاح العام المدمج، طابق productId ومعرّف
              التثبيت والبصمة مع جهازك، وافحص انتهاء الصلاحية.{'\n'}
              4. عند النجاح: احفظ حالة التفعيل (الكود + نسخة من الحقول) في تخزين آمن، وافتح التطبيق.{'\n'}
              5. عند كل تشغيل لاحق: أعد التحقق الكامل صامتاً؛ اعرض رسائل واضحة للحالات: توقيع غير صالح،
              منتج مختلف، جهاز مختلف، ترخيص منتهٍ.{'\n'}
              6. مهم: فتح شاشة التفعيل أو إنشاء طلب تفعيل أو مراسلة المطوّر يجب ألا يُفعّل التطبيق
              أبداً — التفعيل لا يتم إلا بكود موقّع صالح فقط.{'\n'}
              7. مهم: لا تحذف بيانات عمل العميل التجارية أبداً بسبب انتهاء الترخيص أو فشل التحقق —
              اعرض وضع مقيّد مع إبقاء البيانات.
            </P>
          </>
        );
      case 'policy':
        return (
          <>
            <P>
              الترخيص مرتبط بالجهاز (Installation ID + بصمة المفتاح). عند تغيير الهاتف أو إعادة ضبط
              المصنع أو فقدان مفتاح الجهاز: لا يُنقل الترخيص القديم تلقائياً أبداً. يجب أن يرسل العميل
              طلب تفعيل جديداً من التثبيت الجديد، ويصدر المطوّر ترخيصاً جديداً بسجل جديد مع توثيق سبب
              إعادة الإصدار في الملاحظات — مع الاحتفاظ بالسجل القديم للتدقيق.
            </P>
          </>
        );
      case 'security':
        return (
          <>
            <P>
              • لا يُضمَّن المفتاح الخاص أبداً في تطبيق العميل أو الكود الموزّع أو الأصول العامة.{'\n'}
              • النسخ الاحتياطية مشفرة بمصادقة (secretbox) — أي عبث يُكتشف ويُرفض.{'\n'}
              • قيود صادقة: لا ندّعي حماية مطلقة ضد العبث بساعة الجهاز (قد يؤثر على التراخيص المؤقتة
              دون إنترنت)، ولا ضد التطبيقات المعدّلة بإعادة الحزم، ولا ضد الأجهزة المخترقة الجذر.{'\n'}
              • للحماية الأفضل: فعّل Play Integrity / App Attestation في تطبيق العميل، واربط مفتاح
              الجهاز بـ Android Keystore المقيّد بالبصمة عند الإمكان.
            </P>
          </>
        );
      case 'backup':
        return (
          <>
            <P>
              • نسخة المفتاح (PMKB1): المفتاح الخاص مشفّراً بكلمة مرور (KDF تكراري + secretbox). تُستعاد
              بنفس كلمة المرور فقط.{'\n'}
              • نسخة السجلات (PMDB1): قاعدة البيانات كاملة مشفّرة بكلمة مرور. عند الاستعادة يُتحقق من
              السلامة أولاً، ثم تختار: دمج آمن (إضافة المفقود فقط) أو استبدال كامل.{'\n'}
              • احفظ النسخ خارج الجهاز (USB/ورقة/مدير كلمات مرور) واختبر الاستعادة دورياً.
            </P>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.h1, { color: c.text }]}>التوثيق وبروتوكول الدمج</Text>
        <Text style={[styles.sub, { color: c.textSecondary }]}>
          المرجع الكامل لصيغ البيانات والتوقيع وخطوات الدمج في تطبيق العميل.
        </Text>
        {SECTIONS.map((s) => {
          const isOpen = open === s.key;
          return (
            <Card key={s.key}>
              <Pressable onPress={() => toggle(s.key)} style={styles.accHeader}>
                <View style={[styles.accIcon, { backgroundColor: c.primarySoft }]}>
                  <Ionicons name={s.icon as any} size={20} color={c.primary} />
                </View>
                <Text style={[styles.accTitle, { color: c.text }]}>{s.title}</Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={20} color={c.textMuted} />
              </Pressable>
              {isOpen ? <View style={styles.accBody}>{renderBody(s.key)}</View> : null}
            </Card>
          );
        })}
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
  accHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  accTitle: { flex: 1, fontSize: 15, fontWeight: '800' },
  accBody: { marginTop: 12 },
  p: { fontSize: 13.5, lineHeight: 22, marginBottom: 10 },
});
