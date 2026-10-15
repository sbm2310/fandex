import { boxReadingFigure, type BoxReading, type FigureScanResponse } from '@fandex/core';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AddToCollectionButton } from '@/components/add-to-collection-button';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { EntryRow } from '@/components/entry-row';
import { PageTitle } from '@/components/page-title';
import { PreorderLink } from '@/components/preorder-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-account';
import { useFigureScan } from '@/hooks/use-figure-scan';
import { useAiQuota } from '@/hooks/use-shelf-scan';
import { useTheme } from '@/hooks/use-theme';
import { toCatalogEntry } from '@/services/catalog-mapping';
import { toShelfScanError, type ShelfPhoto } from '@/services/shelf-scanner';
import { choosePhoto, privacyNote, takePhoto } from '@/utils/scan-photo';

/**
 * Box scanning: photograph a figure's box, the AI reads its maker, name and number, and Fandex
 * finds it in the shared figure catalog to add or pre-order. When the catalog doesn't have it,
 * the add-by-hand form opens with what was read. Signed-in users only (a shared AI allowance).
 */
export default function FigureScanScreen() {
  const { data: user, isPending: userPending } = useCurrentUser();
  const quota = useAiQuota();
  const scan = useFigureScan();
  const [photo, setPhoto] = useState<ShelfPhoto | null>(null);

  const read = (picked: ShelfPhoto) => {
    setPhoto(picked);
    scan.mutate(picked);
  };
  const startOver = () => {
    scan.reset();
    setPhoto(null);
  };

  if (userPending || (user && quota.isPending)) {
    return (
      <Centered>
        <ActivityIndicator accessibilityLabel="Loading" />
      </Centered>
    );
  }
  if (!user) {
    return (
      <Page>
        <EmptyState
          title="Sign in to scan a box"
          message="Photograph a figure's box and Fandex finds it in its catalog. Scanning uses AI, so it needs an account."
          action={{ label: 'Sign in', href: '/account' }}
        />
      </Page>
    );
  }
  const allowance = quota.data?.figureScans;
  if (quota.isError || !quota.data?.available || !allowance) {
    return (
      <Page>
        <EmptyState
          title="Box scanning is unavailable"
          message={
            quota.isError
              ? "Couldn't reach Fandex. Check your connection and try again."
              : "Box scanning isn't set up on this server yet."
          }
          action={{ label: 'Search instead', href: '/add' }}
        />
      </Page>
    );
  }

  if (scan.data) return <Result result={scan.data} onStartOver={startOver} />;

  if (scan.isPending) {
    return (
      <Centered>
        <ActivityIndicator size="large" accessibilityLabel="Reading the box" />
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Reading the box…
        </ThemedText>
      </Centered>
    );
  }

  const left = Math.max(0, allowance.limit - allowance.used);
  const error = scan.error ? toShelfScanError(scan.error) : null;
  return (
    <Page>
      <View style={styles.section}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Scan a box
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Photograph the front of a figure&apos;s box, or the side with its product code (like
          MMS279). Fandex reads it and finds the figure in its catalog.
        </ThemedText>

        {error ? (
          <View style={styles.section} accessibilityRole="alert">
            <ThemedText type="smallBold">{error.message}</ThemedText>
            {photo && error.kind !== 'quota' && (
              <Button label="Try again" variant="secondary" onPress={() => read(photo)} />
            )}
          </View>
        ) : null}

        {left > 0 ? (
          <View style={styles.actions}>
            {Platform.OS !== 'web' && (
              <Button label="Take a photo" onPress={() => void takePhoto(read)} />
            )}
            <Button
              label="Choose a photo"
              variant={Platform.OS === 'web' ? 'primary' : 'secondary'}
              onPress={() => void choosePhoto(read)}
            />
          </View>
        ) : (
          <ThemedText type="smallBold">
            You&apos;ve used today&apos;s {allowance.limit} box scans. They reset at midnight UTC.
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textSecondary">
          {left === 1 ? '1 scan left today' : `${left} scans left today`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {privacyNote(quota.data.provider, 'read the box')}
        </ThemedText>
      </View>
    </Page>
  );
}

function Result({ result, onStartOver }: { result: FigureScanResponse; onStartOver: () => void }) {
  const { reading, candidates } = result;
  if (!reading) {
    return (
      <Page>
        <EmptyState
          title="Couldn't read this box"
          message="Try a closer photo in good light, of the front or of the side with the product code."
        />
        <Button label="Try another photo" onPress={onStartOver} />
      </Page>
    );
  }

  const byHand = () => {
    const figure = boxReadingFigure(reading);
    router.push({
      pathname: '/add',
      params: {
        kind: 'figures',
        byHand: '1',
        title: figure.title,
        brand: figure.brand ?? '',
        number: figure.number ?? '',
        line: figure.line ?? '',
        scale: figure.scale ?? '',
        edition: figure.edition ?? '',
        // A new value each time, so the Add tab applies it even if it's open already.
        scan: String(Date.now()),
      },
    });
  };

  return (
    <Page>
      <ScrollView contentContainerStyle={styles.section}>
        <ReadingSummary reading={reading} />
        {candidates.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="subtitle" accessibilityRole="header">
              {candidates[0]!.by === 'number' ? 'Found it' : 'Is it one of these?'}
            </ThemedText>
            {candidates.map(({ item, by }) => {
              const entry = toCatalogEntry(item);
              if (!entry) return null;
              return (
                <EntryRow
                  key={item.id}
                  entry={entry}
                  accessory={<AddToCollectionButton entry={entry} />}
                  note={
                    <View style={styles.notes}>
                      {by === 'number' && item.figureNumber ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          Matched by its box number, {item.figureNumber}
                        </ThemedText>
                      ) : null}
                      <PreorderLink entry={entry} />
                    </View>
                  }
                />
              );
            })}
            <Button label="None of these? Add it by hand" variant="secondary" onPress={byHand} />
          </View>
        ) : (
          <View style={styles.section}>
            <ThemedText themeColor="textSecondary">
              This figure isn&apos;t in Fandex&apos;s catalog yet. Add it with what was read, and
              suggest it for the catalog if you like.
            </ThemedText>
            <Button label="Add it by hand" onPress={byHand} />
          </View>
        )}
        <Button label="Scan another box" variant="secondary" onPress={onStartOver} />
      </ScrollView>
    </Page>
  );
}

/** What the AI read, so a misreading is easy to spot. */
function ReadingSummary({ reading }: { reading: BoxReading }) {
  const colors = useTheme();
  const facts: [string, string | undefined][] = [
    ['Maker', reading.brand],
    ['Number', reading.number],
    ['Name', reading.name],
    ['Character', reading.character === reading.name ? undefined : reading.character],
    ['From', reading.from],
    ['Scale', reading.scale],
    ['Edition', reading.edition],
  ];
  return (
    <View style={[styles.summary, { borderColor: colors.border }]}>
      <ThemedText type="section" accessibilityRole="header">
        Read on the box
      </ThemedText>
      {facts.map(([label, value]) =>
        value ? (
          <View key={label} style={styles.fact}>
            <ThemedText type="small" themeColor="textSecondary">
              {label}
            </ThemedText>
            <ThemedText type="small">{value}</ThemedText>
          </View>
        ) : null,
      )}
      <ThemedText type="small" themeColor="textSecondary">
        The AI can misread a box: check before adding.
      </ThemedText>
    </View>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Scan a box" />
      <View style={styles.column}>{children}</View>
    </ThemedView>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={[styles.fill, styles.centered]}>
      <PageTitle title="Scan a box" />
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    alignItems: 'center',
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  centered: {
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
  section: {
    gap: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
  notes: {
    gap: Spacing.one,
  },
  summary: {
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  fact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
});
