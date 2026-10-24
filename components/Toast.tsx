import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './ThemeContext';

interface Props {
  visible: boolean;
  message: string;
  kind?: 'success' | 'error' | 'info';
}

export function Toast({ visible, message, kind = 'info' }: Props) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const translate = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translate, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(translate, { toValue: 16, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity, translate]);

  if (!visible && (opacity as any)._value === 0) return null;

  const c = theme.colors;
  const bg = kind === 'success' ? c.success : kind === 'error' ? c.danger : c.text;
  const icon = kind === 'success' ? 'checkmark-circle' : kind === 'error' ? 'alert-circle' : 'information-circle';

  return (
    <Animated.View
      style={[styles.toast, { opacity, transform: [{ translateY: translate }], backgroundColor: bg }]}
      pointerEvents="none"
    >
      <Ionicons name={icon} size={20} color="#fff" />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

export function useToast(timeoutMs = 2600) {
  const [state, setState] = React.useState<{ visible: boolean; message: string; kind: 'success' | 'error' | 'info' }>({
    visible: false,
    message: '',
    kind: 'info',
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = React.useCallback(
    (message: string, kind: 'success' | 'error' | 'info' = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setState({ visible: true, message, kind });
      timer.current = setTimeout(() => setState((s) => ({ ...s, visible: false })), timeoutMs);
    },
    [timeoutMs]
  );
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return { toast: state, show };
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 28,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 14,
    zIndex: 999,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'right' },
});
