import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { Button } from './button';
import { FormField } from './form-field';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useSignIn, useSignUp } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';

type Mode = 'sign-in' | 'sign-up';

const MIN_PASSWORD_LENGTH = 8;

/** Checks input before calling the server; returns a message or null if it's fine. */
export function validateAuthInput(
  mode: Mode,
  { name, email, password }: { name: string; email: string; password: string },
): string | null {
  if (mode === 'sign-up' && !name.trim()) return 'Enter your name.';
  if (!z.email().safeParse(email.trim()).success) return 'Enter a valid email address.';
  if (mode === 'sign-up' && password.length < MIN_PASSWORD_LENGTH) {
    return `Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!password) return 'Enter your password.';
  return null;
}

/** Sign in, or create an account, with email and password. */
export function AuthForm() {
  const colors = useTheme();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const signIn = useSignIn();
  const signUp = useSignUp();
  const action = mode === 'sign-in' ? signIn : signUp;
  const error = validationError ?? action.error?.message ?? null;

  function submit() {
    const problem = validateAuthInput(mode, { name, email, password });
    setValidationError(problem);
    if (problem) return;
    if (mode === 'sign-in') signIn.mutate({ email: email.trim(), password });
    else signUp.mutate({ name: name.trim(), email: email.trim(), password });
  }

  function switchMode() {
    setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in');
    setValidationError(null);
    signIn.reset();
    signUp.reset();
  }

  return (
    <View style={styles.form}>
      <ThemedText type="subtitle">
        {mode === 'sign-in' ? 'Sign in' : 'Create an account'}
      </ThemedText>
      {mode === 'sign-up' && (
        <FormField
          label="Name"
          value={name}
          onChangeText={setName}
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
        />
      )}
      <FormField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
      />
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
        textContentType={mode === 'sign-in' ? 'password' : 'newPassword'}
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {error && (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: colors.danger }}>
          {error}
        </ThemedText>
      )}
      <Button
        label={mode === 'sign-in' ? 'Sign in' : 'Create account'}
        onPress={submit}
        busy={action.isPending}
      />
      <Pressable accessibilityRole="button" onPress={switchMode} style={styles.switch}>
        <ThemedText type="small" themeColor="accent">
          {mode === 'sign-in'
            ? 'New to Fandex? Create an account'
            : 'Already have an account? Sign in'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  switch: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
});
