import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAiQuota } from '@/hooks/use-shelf-scan';
import { useTheme } from '@/hooks/use-theme';
import { allowanceRows, resetText, type AllowanceRow } from '@/utils/ai-allowance';
import { privacyNote } from '@/utils/scan-photo';

/** Today's AI allowance (shelf scans, box scans, questions) and who reads the photos. */
export function AiAllowanceCard() {
  const quota = useAiQuota();

  // Nothing until it's known (no placeholder flash); the rest of the page doesn't depend on it.
  if (quota.isPending) return null;

  return (
    <Card style={styles.card}>
      <ThemedText type="section">AI allowance</ThemedText>
      {quota.isError ? (
        <>
          <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">
            Couldn&apos;t load your AI allowance.
          </ThemedText>
          <Button label="Try again" variant="secondary" onPress={() => void quota.refetch()} />
        </>
      ) : !quota.data.available ? (
        <ThemedText type="small" themeColor="textSecondary">
          AI features are unavailable right now. Questions are still answered by matching words.
        </ThemedText>
      ) : (
        <>
          {allowanceRows(quota.data).map((row) => (
            <AllowanceMeter key={row.label} row={row} />
          ))}
          <ThemedText type="small" themeColor="textSecondary">
            {resetText(new Date())}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {privacyNote(quota.data.provider, 'read titles and box numbers')} For questions, only
            the question is sent, never your collection.
          </ThemedText>
        </>
      )}
    </Card>
  );
}

function AllowanceMeter({ row }: { row: AllowanceRow }) {
  const colors = useTheme();
  const { used, limit } = row.quota;
  const share = limit > 0 ? Math.min(1, used / limit) : 1;
  return (
    <View
      style={styles.meter}
      accessible
      accessibilityLabel={`${row.label}: ${used} of ${limit} used today`}
    >
      <View style={styles.meterText}>
        <ThemedText type="smallBold">{row.label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {used} of {limit}
        </ThemedText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.backgroundSelected }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${Math.round(share * 100)}%`,
              backgroundColor: used >= limit ? colors.money : colors.accent,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  meter: {
    gap: Spacing.one,
  },
  meterText: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
