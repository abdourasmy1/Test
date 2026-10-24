import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

interface BtnProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'whatsapp';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
}

export function AppButton({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
  small,
}: BtnProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const bg =
    variant === 'primary'
      ? c.primary
      : variant === 'danger'
        ? c.danger
        : variant === 'whatsapp'
          ? '#1FA855'
          : variant === 'ghost'
            ? 'transparent'
            : c.primarySoft;
  const fg =
    variant === 'primary' || variant === 'danger' || variant === 'whatsapp'
      ? '#FFFFFF'
      : variant === 'ghost'
        ? c.primary
        : c.primary;
  const borderColor = variant === 'ghost' ? c.border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          paddingVertical: small ? 9 : 14,
          borderRadius: theme.radius.m,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <Ionicons name={icon} size={small ? 16 : 20} color={fg} style={styles.icon} /> : null}
          <Text style={[styles.title, { color: fg, fontSize: small ? 14 : 16 }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    minHeight: 48,
  } as ViewStyle,
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  icon: { marginEnd: 8 },
  title: { fontWeight: '700' } as TextStyle,
});
