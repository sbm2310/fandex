import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from './button';
import { FormField } from './form-field';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-account';
import { useAddFigure } from '@/hooks/use-add-figure';
import { useSuggestFigure } from '@/hooks/use-figure-suggestions';
import { useTheme } from '@/hooks/use-theme';

const SCALES = ['1/6', '1/4', '1/12', 'Life-size'] as const;

/**
 * Adds a figure by hand, when Fandex's figure catalog doesn't have it (the Add tab's "Not
 * here? Add it by hand"). Fandex links it to the universes and characters its name and line
 * mention; the user can fix that later. It's private to its owner.
 */
export function AddFigureForm({
  initialTitle = '',
  onBack,
}: {
  /** What was searched for, as a starting name. */
  initialTitle?: string;
  /** Back to the catalog search. */
  onBack?: () => void;
}) {
  const colors = useTheme();
  const addFigure = useAddFigure();
  const { data: user } = useCurrentUser();
  const [title, setTitle] = useState(initialTitle);
  const [brand, setBrand] = useState('');
  const [number, setNumber] = useState('');
  const [line, setLine] = useState('');
  const [scale, setScale] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [suggest, setSuggest] = useState(false);
  const suggestFigure = useSuggestFigure();

  const imageInvalid = coverUrl.trim() !== '' && !/^https:\/\/\S+$/.test(coverUrl.trim());
  const canSave = title.trim() !== '' && !imageInvalid && !addFigure.isPending;

  /** On order, not here yet: describe the pre-order next (the figure is saved with it). */
  const preorder = () => {
    if (!canSave) return;
    router.push({
      pathname: '/preorder/new',
      params: {
        figure: '1',
        title: title.trim(),
        brand,
        number,
        line,
        scale,
        coverUrl: coverUrl.trim(),
      },
    });
  };

  const save = () => {
    if (!canSave) return;
    addFigure.mutate(
      { title, brand, number, line, scale, coverUrl },
      {
        onSuccess: (item) => {
          // Signed in only (the checkbox is); the figure's page shows how it went.
          const catalogItemId = item.catalog.catalogId;
          if (suggest && catalogItemId) suggestFigure.mutate({ catalogItemId });
          // Ready for the next one; Back from the figure's page returns here.
          for (const clear of [setTitle, setBrand, setNumber, setLine, setScale, setCoverUrl]) {
            clear('');
          }
          router.push({ pathname: '/book/[id]', params: { id: item.id } });
        },
      },
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      // Number pads have no return key on iPhone: scrolling puts the keyboard away.
      keyboardDismissMode="on-drag"
    >
      <View style={styles.column}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.back}>
            <ThemedText type="small" themeColor="accent">
              ‹ Back to search
            </ThemedText>
          </Pressable>
        ) : null}
        <ThemedText themeColor="textSecondary">
          Not in Fandex&apos;s catalog yet? Describe it: name the character and Fandex links it to
          its universe. Only you will see it.
        </ThemedText>

        <FormField
          label="Name"
          value={title}
          onChangeText={setTitle}
          placeholder="Gandalf the Grey"
          autoCapitalize="words"
          returnKeyType="next"
        />
        <FormField
          label="Brand (optional)"
          value={brand}
          onChangeText={setBrand}
          placeholder="Hot Toys"
          autoCapitalize="words"
        />
        <FormField
          label="Number on the box (optional)"
          value={number}
          onChangeText={setNumber}
          placeholder="MMS 279"
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <FormField
          label="Line or series (optional)"
          value={line}
          onChangeText={setLine}
          placeholder="The Lord of the Rings, Movie Masterpiece"
        />
        <View style={styles.scale}>
          <FormField
            label="Scale (optional)"
            value={scale}
            onChangeText={setScale}
            placeholder="1/6"
            autoCapitalize="none"
          />
          <View style={styles.chips}>
            {SCALES.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Scale ${option}`}
                accessibilityState={{ selected: scale === option }}
                onPress={() => setScale(option)}
                style={StyleSheet.flatten([
                  styles.chip,
                  { borderColor: scale === option ? colors.accent : colors.border },
                ])}
              >
                <ThemedText type="small">{option}</ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
        <FormField
          label="Picture link (optional)"
          value={coverUrl}
          onChangeText={setCoverUrl}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        {imageInvalid ? (
          <ThemedText type="small" style={{ color: colors.danger }} accessibilityRole="alert">
            The picture link must start with https://
          </ThemedText>
        ) : null}

        {/* Suggestions are reviewed in an account. */}
        {user ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: suggest }}
            accessibilityLabel="Suggest it for Fandex's catalog"
            onPress={() => setSuggest((value) => !value)}
            style={styles.checkRow}
          >
            <View
              style={StyleSheet.flatten([
                styles.checkbox,
                { borderColor: suggest ? colors.accent : colors.border },
                suggest && { backgroundColor: colors.accent },
              ])}
            >
              {suggest ? (
                <ThemedText type="smallBold" style={{ color: colors.onAccent }}>
                  ✓
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.checkText}>
              <ThemedText type="small">Suggest it for Fandex&apos;s catalog</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Once it&apos;s checked, every collector can find it (without its picture).
              </ThemedText>
            </View>
          </Pressable>
        ) : null}

        {addFigure.isError ? (
          <ThemedText type="smallBold" accessibilityRole="alert">
            Couldn&apos;t save the figure. Check your connection and try again.
          </ThemedText>
        ) : null}
        <Button
          label="Add to collection"
          onPress={save}
          disabled={!canSave}
          busy={addFigure.isPending}
        />
        {/* Pre-orders live in an account. */}
        {user ? (
          <Button
            label="It's on pre-order"
            variant="secondary"
            onPress={preorder}
            disabled={!canSave}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.four,
  },
  column: {
    gap: Spacing.three,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderRadius: Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    flex: 1,
    gap: Spacing.half,
  },
  back: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  scale: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
});
