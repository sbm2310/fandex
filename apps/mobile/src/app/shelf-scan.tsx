import type { AiProviderInfo, ShelfScanResponse } from '@fandex/core';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { PageTitle } from '@/components/page-title';
import { ShelfReviewItem } from '@/components/shelf-review-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-account';
import { useAddToCollection } from '@/hooks/use-collection';
import { useAiQuota, useShelfScan } from '@/hooks/use-shelf-scan';
import { toShelfScanError, type ShelfPhoto } from '@/services/shelf-scanner';
import {
  chooseCandidate,
  chosenEntries,
  initialChoices,
  reviewOrder,
  toggleChoice,
  type ShelfChoice,
} from '@/utils/shelf-selection';

/**
 * Shelf scanning: photograph one shelf, the AI reads the spines, and the user ticks which of
 * the matched catalog entries to add. Signed-in users only (scans use a shared AI allowance).
 */
export default function ShelfScanScreen() {
  const { data: user, isPending: userPending } = useCurrentUser();
  const quota = useAiQuota();
  const scan = useShelfScan();
  const [photo, setPhoto] = useState<ShelfPhoto | null>(null);
  const [result, setResult] = useState<ShelfScanResponse | null>(null);
  const [choices, setChoices] = useState<ShelfChoice[]>([]);
  const [added, setAdded] = useState<number | null>(null);

  const read = (picked: ShelfPhoto) => {
    setPhoto(picked);
    scan.mutate(picked, {
      onSuccess: (response) => {
        setResult(response);
        setChoices(initialChoices(response.items));
      },
    });
  };
  const startOver = () => {
    scan.reset();
    setPhoto(null);
    setResult(null);
    setAdded(null);
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
          title="Sign in to scan a shelf"
          message="Photograph a shelf and Fandex adds what's on it. Scanning uses AI, so it needs an account."
          action={{ label: 'Sign in', href: '/account' }}
        />
      </Page>
    );
  }
  if (quota.isError || !quota.data?.available) {
    return (
      <Page>
        <EmptyState
          title="Shelf scanning is unavailable"
          message={
            quota.isError
              ? "Couldn't reach Fandex. Check your connection and try again."
              : "Shelf scanning isn't set up on this server yet."
          }
          action={{ label: 'Search instead', href: '/add' }}
        />
      </Page>
    );
  }

  if (added !== null) {
    return (
      <Page>
        <View style={styles.centeredBlock}>
          <ThemedText type="subtitle" accessibilityRole="header" style={styles.centerText}>
            {added === 1 ? 'Added 1 item' : `Added ${added} items`}
          </ThemedText>
          <Button label="See your collection" onPress={() => router.replace('/')} />
          <Button label="Scan another shelf" variant="secondary" onPress={startOver} />
        </View>
      </Page>
    );
  }

  if (result) {
    return (
      <Review
        result={result}
        choices={choices}
        setChoices={setChoices}
        onAdded={setAdded}
        onStartOver={startOver}
      />
    );
  }

  if (scan.isPending) {
    return (
      <Centered>
        <ActivityIndicator size="large" accessibilityLabel="Reading your shelf" />
        <ThemedText themeColor="textSecondary" style={styles.centerText}>
          Reading your shelf… this takes about 10 seconds.
        </ThemedText>
      </Centered>
    );
  }

  const { used, limit } = quota.data.shelfScans;
  const left = Math.max(0, limit - used);
  const error = scan.error ? toShelfScanError(scan.error) : null;

  return (
    <Page>
      <View style={styles.intro}>
        <ThemedText type="subtitle" accessibilityRole="header">
          Scan a shelf
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Photograph one shelf at a time, close enough to read the spines. Fandex reads the titles
          and finds them in the catalog; you choose what to add.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Works best with English spines and good light. It finds about half the items on a shelf,
          so check the list before adding.
        </ThemedText>

        {error ? (
          <View style={styles.error} accessibilityRole="alert">
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
            You&apos;ve used today&apos;s {limit} shelf scans. They reset at midnight UTC.
          </ThemedText>
        )}

        <ThemedText type="small" themeColor="textSecondary">
          {left === 1 ? '1 scan left today' : `${left} scans left today`}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {privacyNote(quota.data.provider)}
        </ThemedText>
      </View>
    </Page>
  );
}

/** Where the photo goes, as the server reports it. */
function privacyNote(provider: AiProviderInfo | undefined): string {
  if (!provider) return 'Your photo is sent to an AI service to read the spines.';
  return provider.usesPhotosForTraining
    ? `Your photo is sent to ${provider.name}, an AI service, to read the spines. Its free tier may use photos to improve its products, so don't include anything private.`
    : `Your photo is sent to ${provider.name}, an AI service, to read the spines. It isn't stored or used to train AI.`;
}

async function choosePhoto(onPicked: (photo: ShelfPhoto) => void) {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset) onPicked({ uri: asset.uri, width: asset.width, height: asset.height });
}

async function takePhoto(onPicked: (photo: ShelfPhoto) => void) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return choosePhoto(onPicked);
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset) onPicked({ uri: asset.uri, width: asset.width, height: asset.height });
}

function Review({
  result,
  choices,
  setChoices,
  onAdded,
  onStartOver,
}: {
  result: ShelfScanResponse;
  choices: ShelfChoice[];
  setChoices: (choices: ShelfChoice[]) => void;
  onAdded: (count: number) => void;
  onStartOver: () => void;
}) {
  const add = useAddToCollection();
  const [progress, setProgress] = useState<{ done: number; failed: number } | null>(null);
  const { items } = result;
  const entries = chosenEntries(items, choices);
  const order = reviewOrder(items);
  const firstUnsure = order.find((index) => !items[index]!.sure);

  const addAll = async () => {
    let done = 0;
    let failed = 0;
    setProgress({ done, failed });
    // One at a time, so the collection isn't flooded with parallel writes.
    for (const entry of entries) {
      try {
        await add.mutateAsync(entry);
        done += 1;
      } catch {
        failed += 1;
      }
      setProgress({ done, failed });
    }
    if (failed === 0) onAdded(done);
  };

  if (items.length === 0) {
    return (
      <Page>
        <EmptyState
          title="Nothing recognized"
          message="Try a closer photo of one shelf, in good light, with the spines facing the camera."
        />
        <Button label="Try another photo" onPress={onStartOver} />
      </Page>
    );
  }

  return (
    <Page>
      <FlatList
        data={order}
        keyExtractor={(index) => `${index}:${items[index]!.reading.title}`}
        ListHeaderComponent={
          <View style={styles.reviewHeader}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Found {items.length === 1 ? '1 item' : `${items.length} items`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Fandex ticked what it&apos;s surest about. Check the list; the AI makes mistakes.
            </ThemedText>
          </View>
        }
        renderItem={({ item: index }) => (
          <>
            {index === firstUnsure && (
              <View style={styles.sectionHeader}>
                <ThemedText type="smallBold" accessibilityRole="header">
                  Less sure
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Found in only one of two readings of the photo. These are often wrong; tick the
                  ones you see.
                </ThemedText>
              </View>
            )}
            <ShelfReviewItem
              item={items[index]!}
              choice={choices[index] ?? { candidate: 0, checked: false }}
              onToggle={() => setChoices(toggleChoice(choices, index))}
              onChoose={(candidate) =>
                setChoices(chooseCandidate(items, choices, index, candidate))
              }
            />
          </>
        )}
      />
      <View style={styles.footer}>
        {progress && progress.failed > 0 ? (
          <ThemedText type="smallBold" accessibilityRole="alert">
            {progress.failed === 1
              ? "1 item couldn't be added. Try again."
              : `${progress.failed} items couldn't be added. Try again.`}
          </ThemedText>
        ) : null}
        <Button
          label={
            progress && add.isPending
              ? `Adding ${progress.done + progress.failed + 1} of ${entries.length}…`
              : entries.length === 1
                ? 'Add 1 item'
                : `Add ${entries.length} items`
          }
          busy={add.isPending}
          disabled={entries.length === 0}
          onPress={() => void addAll()}
        />
        <Button label="Scan another shelf" variant="secondary" onPress={onStartOver} />
      </View>
    </Page>
  );
}

function Page({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Scan a shelf" />
      <View style={styles.column}>{children}</View>
    </ThemedView>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <ThemedView style={[styles.fill, styles.centered]}>
      <PageTitle title="Scan a shelf" />
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
  centeredBlock: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  intro: {
    gap: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
  },
  error: {
    gap: Spacing.two,
  },
  reviewHeader: {
    gap: Spacing.one,
  },
  sectionHeader: {
    gap: Spacing.one,
    paddingTop: Spacing.four,
  },
  footer: {
    gap: Spacing.two,
  },
});
