import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { I18nManager } from 'react-native';

import { ThemeProvider, useTheme } from '../components/ThemeContext';
import { AppProvider, useAppStore } from '../store/appContext';
import type { MainTabParamList, RootStackParamList } from './types';

import { SetupKeyScreen } from '../screens/SetupKeyScreen';
import { SetupBackupScreen } from '../screens/SetupBackupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { NewLicenseScreen } from '../screens/NewLicenseScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { VerifyScreen } from '../screens/VerifyScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { LicenseResultScreen } from '../screens/LicenseResultScreen';
import { LicenseDetailScreen } from '../screens/LicenseDetailScreen';
import { KeyBackupScreen, KeyRestoreScreen } from '../screens/KeyBackupScreens';
import { DbBackupScreen, DbRestoreScreen } from '../screens/DbBackupScreens';
import { TestToolScreen } from '../screens/TestToolScreen';
import { SelfTestScreen } from '../screens/SelfTestScreen';
import { DocsScreen } from '../screens/DocsScreen';

try {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
} catch {
  // RTL forcing is best-effort (needs reload on native for full effect)
}

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.tabInactive,
        tabBarStyle: {
          backgroundColor: c.surface,
          borderTopColor: c.border,
          height: 62,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Home: 'home',
            NewLicense: 'add-circle',
            History: 'folder-open',
            Verify: 'shield-checkmark',
            More: 'menu',
          };
          return <Ionicons name={icons[route.name] ?? 'ellipse'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'الرئيسية' }} />
      <Tab.Screen name="NewLicense" component={NewLicenseScreen} options={{ tabBarLabel: 'ترخيص جديد' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'السجل' }} />
      <Tab.Screen name="Verify" component={VerifyScreen} options={{ tabBarLabel: 'التحقق' }} />
      <Tab.Screen name="More" component={MoreScreen} options={{ tabBarLabel: 'المزيد' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { ready, settings } = useAppStore();

  if (!ready) {
    return (
      <View style={[styles.splash, { backgroundColor: c.background }]}>
        <Ionicons name="shield-checkmark" size={56} color={c.primary} />
        <Text style={[styles.splashTitle, { color: c.text }]}>مدير تراخيص Poultry Manager</Text>
        <ActivityIndicator size="small" color={c.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={settings.setupComplete ? 'Main' : 'SetupKey'}
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '800' },
        contentStyle: { backgroundColor: c.background },
      }}
    >
      <Stack.Screen name="SetupKey" component={SetupKeyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SetupBackup" component={SetupBackupScreen} options={{ title: 'النسخة الاحتياطية' }} />
      <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen name="LicenseResult" component={LicenseResultScreen} options={{ title: 'نتيجة الترخيص', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="LicenseDetail" component={LicenseDetailScreen} options={{ title: 'تفاصيل الترخيص', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="KeyBackup" component={KeyBackupScreen} options={{ title: 'نسخة المفتاح', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="KeyRestore" component={KeyRestoreScreen} options={{ title: 'استعادة المفتاح', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="DbBackup" component={DbBackupScreen} options={{ title: 'نسخة السجلات', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="DbRestore" component={DbRestoreScreen} options={{ title: 'استعادة السجلات', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="TestTool" component={TestToolScreen} options={{ title: 'أداة الاختبار', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="SelfTest" component={SelfTestScreen} options={{ title: 'الاختبار الذاتي', headerBackTitle: 'رجوع' }} />
      <Stack.Screen name="Docs" component={DocsScreen} options={{ title: 'التوثيق', headerBackTitle: 'رجوع' }} />
    </Stack.Navigator>
  );
}

function ThemedApp() {
  const { theme } = useTheme();
  const { settings, setThemeMode } = useAppStore();
  void settings;
  void setThemeMode;
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </>
  );
}

function ThemeBridge({ children }: { children: React.ReactNode }) {
  const { settings, setThemeMode } = useAppStore();
  return (
    <ThemeProvider mode={settings.themeMode} setMode={setThemeMode}>
      {children}
    </ThemeProvider>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({ ...Ionicons.font });
  if (!fontsLoaded) return null;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <ThemeBridge>
          <ThemedApp />
        </ThemeBridge>
      </AppProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashTitle: { fontSize: 18, fontWeight: '900', marginTop: 12 },
});
