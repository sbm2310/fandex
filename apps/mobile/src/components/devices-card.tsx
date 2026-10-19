import type { DeviceSession } from '@fandex/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Pill } from '@/components/pill';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useDevices, useSignOutDevice, useSignOutOtherDevices } from '@/hooks/use-devices';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/utils/confirm';

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

const devicesText = (count: number) => (count === 1 ? '1 other device' : `${count} other devices`);

/** Where you're signed in, with a way to sign out a lost phone or a shared computer. */
export function DevicesCard() {
  const colors = useTheme();
  const devices = useDevices();
  const signOutDevice = useSignOutDevice();
  const signOutOthers = useSignOutOtherDevices();
  const [notice, setNotice] = useState<string | null>(null);

  // Nothing until it's known (no placeholder flash).
  if (devices.isPending) return null;

  const others = devices.data?.filter((session) => !session.current) ?? [];
  const failure = signOutDevice.error ?? signOutOthers.error;

  async function everywhereElse() {
    const confirmed = await confirm({
      title: 'Sign out everywhere else?',
      message: `This signs Fandex out on ${devicesText(others.length)}. This device stays signed in.`,
      confirmLabel: 'Sign out',
      destructive: true,
    });
    if (!confirmed) return;
    setNotice(null);
    signOutOthers.mutate(undefined, {
      onSuccess: (count) => setNotice(`Signed out of ${devicesText(count)}.`),
    });
  }

  return (
    <Card style={styles.card}>
      <ThemedText type="section">Signed-in devices</ThemedText>
      {devices.isError ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">
            Couldn&apos;t load your devices.
          </ThemedText>
          <Button label="Try again" variant="secondary" onPress={() => void devices.refetch()} />
        </>
      ) : (
        <>
          {devices.data.map((session) => (
            <DeviceRow
              key={session.id}
              session={session}
              busy={signOutDevice.isPending && signOutDevice.variables === session.id}
              onSignOut={() => {
                setNotice(null);
                signOutDevice.mutate(session.id, {
                  onSuccess: () => setNotice(`Signed out of ${session.device}.`),
                });
              }}
            />
          ))}
          {others.length > 1 && (
            <Button
              label="Sign out everywhere else"
              variant="danger"
              busy={signOutOthers.isPending}
              onPress={() => void everywhereElse()}
            />
          )}
        </>
      )}
      {notice && <ThemedText accessibilityRole="alert">{notice}</ThemedText>}
      {failure && (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: colors.danger }}>
          {failure.message}
        </ThemedText>
      )}
    </Card>
  );
}

function DeviceRow({
  session,
  busy,
  onSignOut,
}: {
  session: DeviceSession;
  busy: boolean;
  onSignOut: () => void;
}) {
  const colors = useTheme();
  const signedIn = day(session.signedInAt);
  const active = day(session.lastActiveAt);
  return (
    <View style={[styles.row, { borderTopColor: colors.border }]}>
      <View style={styles.rowText}>
        <View style={styles.nameLine}>
          <ThemedText type="smallBold">{session.device}</ThemedText>
          {session.current && <Pill label="This device" />}
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Signed in {signedIn}
          {active !== signedIn ? ` · active ${active}` : ''}
        </ThemedText>
      </View>
      {!session.current && (
        <Button
          label="Sign out"
          variant="secondary"
          accessibilityLabel={`Sign out ${session.device}, signed in ${signedIn}`}
          busy={busy}
          onPress={onSignOut}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  nameLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
