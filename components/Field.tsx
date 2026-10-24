import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useTheme } from './ThemeContext';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
  error?: string | null;
  mono?: boolean;
}

export function Field({ label, hint, error, mono, style, ...rest }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.text }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: c.inputBg,
            borderColor: error ? c.danger : focused ? c.primary : c.border,
            color: c.text,
            borderRadius: theme.radius.m,
            fontFamily: mono ? 'monospace' : undefined,
            textAlign: mono ? 'left' : 'right',
          },
          style as any,
        ]}
        placeholderTextColor={c.textMuted}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...rest}
      />
      {error ? <Text style={[styles.hint, { color: c.danger }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 50,
  },
  hint: { fontSize: 12, marginTop: 5, lineHeight: 17 },
});
