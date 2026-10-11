import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from './button';
import { FormField } from './form-field';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useAddFigure } from '@/hooks/use-add-figure';
import { useTheme } from '@/hooks/use-theme';

const SCALES = ['1/6', '1/4', '1/12', 'Life-size'] as const;

/**
 * Adds a figure by hand (Hot Toys and similar: no public catalog covers them), on the Add
 * tab's "Figures" option. Fandex links it to the universes and characters its name and line
 * mention; the user can fix that later.
 */
export function AddFigureForm() {
  const colors = useTheme();
  const addFigure = useAddFigure();
  const [title, setTitle] = useState('');
  const [brand, setBrand] = useState('');
  const [line, setLine] = useState('');
  const [scale, setScale] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const imageInvalid = coverUrl.trim() !== '' && !/^https:\/\/\S+$/.test(coverUrl.trim());
  const canSave = title.trim() !== '' && !imageInvalid && !addFigure.isPending;

  const save = () => {
    if (!canSave) return;
    addFigure.mutate(
      { title, brand, line, scale, coverUrl },
      {
        onSuccess: (item) => {
          // Ready for the next one; Back from the figure's page returns here.
          for (const clear of [setTitle, setBrand, setLine, setScale, setCoverUrl]) clear('');
          router.push({ pathname: '/book/[id]', params: { id: item.id } });
        },
      },
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.column}>
        <ThemedText themeColor="textSecondary">
          No catalog has figures like Hot Toys, so describe yours. Name the character and Fandex
          links it to its universe.
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
