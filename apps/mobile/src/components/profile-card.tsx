import { displayNameSchema } from '@fandex/core';
import { useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { FormField } from '@/components/form-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useChangePassword, useUpdateName } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';
import type { AccountUser } from '@/services/account-service';

const MIN_PASSWORD = 8;

/** The signed-in user's name and email, with forms to rename and change the password. */
export function ProfileCard({ user }: { user: AccountUser }) {
  const [editing, setEditing] = useState<'name' | 'password' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function finish(message: string | null) {
    setEditing(null);
    setNotice(message);
  }

  return (
    <Card style={styles.card}>
      <ThemedText type="section">Profile</ThemedText>
      {editing === 'name' ? (
        <NameForm current={user.name} onDone={finish} />
      ) : (
        <View style={styles.identity}>
          <ThemedText type="smallBold">{user.name}</ThemedText>
          <ThemedText themeColor="textSecondary">{user.email}</ThemedText>
        </View>
      )}
      {editing === 'password' && <PasswordForm onDone={finish} />}
      {notice && <ThemedText accessibilityRole="alert">{notice}</ThemedText>}
      {editing === null && (
        <View style={styles.actions}>
          <Button
            label="Edit name"
            variant="secondary"
            onPress={() => {
              setNotice(null);
              setEditing('name');
            }}
          />
          <Button
            label="Change password"
            variant="secondary"
            onPress={() => {
              setNotice(null);
              setEditing('password');
            }}
          />
        </View>
      )}
    </Card>
  );
}

function NameForm({
  current,
  onDone,
}: {
  current: string;
  onDone: (notice: string | null) => void;
}) {
  const [name, setName] = useState(current);
  const [problem, setProblem] = useState<string | null>(null);
  const updateName = useUpdateName();

  function save() {
    const parsed = displayNameSchema.safeParse(name);
    if (!parsed.success) {
      setProblem(parsed.error.issues[0]?.message ?? 'Enter your name.');
      return;
    }
    setProblem(null);
    if (parsed.data === current) return onDone(null);
    updateName.mutate({ name: parsed.data }, { onSuccess: () => onDone('Name saved.') });
  }

  return (
    <View style={styles.form}>
      <FormField
        label="Name"
        value={name}
        onChangeText={setName}
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={save}
      />
      <ErrorText message={problem ?? updateName.error?.message} />
      <Button label="Save name" busy={updateName.isPending} onPress={save} />
      <Button label="Cancel" variant="secondary" onPress={() => onDone(null)} />
    </View>
  );
}

function PasswordForm({ onDone }: { onDone: (notice: string | null) => void }) {
  const colors = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeated, setRepeated] = useState('');
  const [signOutOtherDevices, setSignOutOtherDevices] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const changePassword = useChangePassword();

  function save() {
    let message: string | null = null;
    if (!currentPassword) message = 'Enter your current password.';
    else if (newPassword.length < MIN_PASSWORD)
      message = `Use a new password of at least ${MIN_PASSWORD} characters.`;
    else if (newPassword !== repeated) message = "The new passwords don't match.";
    setProblem(message);
    if (message) return;
    changePassword.mutate(
      { currentPassword, newPassword, signOutOtherDevices },
      {
        onSuccess: () =>
          onDone(
            signOutOtherDevices
              ? 'Password changed. Your other devices are signed out.'
              : 'Password changed.',
          ),
      },
    );
  }

  return (
    <View style={styles.form}>
      <FormField
        label="Current password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <FormField
        label="New password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <FormField
        label="New password again"
        value={repeated}
        onChangeText={setRepeated}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <View style={styles.switchRow}>
        <ThemedText style={styles.switchLabel}>Sign out my other devices</ThemedText>
        <Switch
          accessibilityLabel="Sign out my other devices"
          value={signOutOtherDevices}
          onValueChange={setSignOutOtherDevices}
          trackColor={{ true: colors.accent, false: colors.border }}
          thumbColor={signOutOtherDevices ? colors.onAccent : colors.textSecondary}
          // react-native-web colours the "on" thumb with its own prop (teal by default).
          {...(Platform.OS === 'web' && { activeThumbColor: colors.onAccent })}
        />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Forgot your password? Recovery by email isn&apos;t available yet, so keep it somewhere safe.
      </ThemedText>
      <ErrorText message={problem ?? changePassword.error?.message} />
      <Button label="Save password" busy={changePassword.isPending} onPress={save} />
      <Button label="Cancel" variant="secondary" onPress={() => onDone(null)} />
    </View>
  );
}

function ErrorText({ message }: { message: string | null | undefined }) {
  const colors = useTheme();
  if (!message) return null;
  return (
    <ThemedText type="small" accessibilityRole="alert" style={{ color: colors.danger }}>
      {message}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  identity: {
    gap: Spacing.half,
  },
  actions: {
    gap: Spacing.two,
  },
  form: {
    gap: Spacing.three,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  switchLabel: {
    flexShrink: 1,
  },
});
