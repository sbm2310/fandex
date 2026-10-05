import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AuthForm } from '@/components/auth-form';
import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { PageTitle } from '@/components/page-title';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCurrentUser, useDeleteAccount, useSignOut } from '@/hooks/use-account';
import { useTheme } from '@/hooks/use-theme';
import type { AccountUser } from '@/services/account-service';
import { confirm } from '@/utils/confirm';

export default function AccountScreen() {
  const currentUser = useCurrentUser();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <Screen>
      <PageTitle title="Account" />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {currentUser.isPending ? (
          <ActivityIndicator accessibilityLabel="Loading account" />
        ) : currentUser.isError ? (
          <View style={styles.section}>
            <ThemedText type="subtitle">Account</ThemedText>
            <ThemedText themeColor="textSecondary">{currentUser.error.message}</ThemedText>
            <ThemedText themeColor="textSecondary">
              Your collection on this device still works without an account.
            </ThemedText>
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => void currentUser.refetch()}
            />
          </View>
        ) : currentUser.data ? (
          <SignedIn
            user={currentUser.data}
            onDeleted={() => setNotice('Your account has been deleted.')}
          />
        ) : (
          <View style={styles.section}>
            {notice && <ThemedText accessibilityRole="alert">{notice}</ThemedText>}
            <ThemedText themeColor="textSecondary">
              Sign in to keep your collection in your account. Without an account, your books stay
              on this device.
            </ThemedText>
            <AuthForm />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SignedIn({ user, onDeleted }: { user: AccountUser; onDeleted: () => void }) {
  const signOut = useSignOut();

  return (
    <View style={styles.section}>
      <ThemedText type="subtitle">Account</ThemedText>
      <View style={styles.identity}>
        <ThemedText type="smallBold">{user.name}</ThemedText>
        <ThemedText themeColor="textSecondary">{user.email}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Your collection is still saved on this device. Syncing it to your account is coming soon.
      </ThemedText>
      <Button
        label="Sign out"
        variant="secondary"
        busy={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
      <DeleteAccount onDeleted={onDeleted} />
    </View>
  );
}

/** App Store guideline 5.1.1(v): accounts created in the app must be deletable in the app. */
function DeleteAccount({ onDeleted }: { onDeleted: () => void }) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const deleteAccount = useDeleteAccount();

  async function submit() {
    const confirmed = await confirm({
      title: 'Delete your account?',
      message:
        'This permanently deletes your Fandex account. Books saved on this device stay on this device.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!confirmed) return;
    deleteAccount.mutate({ password }, { onSuccess: onDeleted });
  }

  if (!open) {
    return <Button label="Delete account" variant="danger" onPress={() => setOpen(true)} />;
  }

  return (
    <View style={[styles.danger, { borderColor: colors.danger }]}>
      <ThemedText type="smallBold">Delete account</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Enter your password to confirm. This can&apos;t be undone.
      </ThemedText>
      <FormField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      {deleteAccount.error && (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: colors.danger }}>
          {deleteAccount.error.message}
        </ThemedText>
      )}
      <Button
        label="Delete permanently"
        variant="danger"
        busy={deleteAccount.isPending}
        disabled={!password}
        onPress={() => void submit()}
      />
      <Button
        label="Cancel"
        variant="secondary"
        onPress={() => {
          setOpen(false);
          setPassword('');
          deleteAccount.reset();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.four,
  },
  section: {
    gap: Spacing.three,
  },
  identity: {
    gap: Spacing.half,
  },
  danger: {
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
});
