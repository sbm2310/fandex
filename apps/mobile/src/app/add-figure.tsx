import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormField } from '@/components/form-field';
import { PageTitle } from '@/components/page-title';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAddFigure } from '@/hooks/use-add-figure';
import { useTheme } from '@/hooks/use-theme';

const SCALES = ['1/6', '1/4', '1/12', 'Life-size'] as const;

/**
 * Adds a figure by hand (Hot Toys and similar: no public catalog covers them). Fandex links
 * it to the universes and characters its name and line mention; the user can fix that later.
 */
export default function AddFigureScreen() {
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
        onSuccess: (item) => router.replace({ pathname: '/book/[id]', params: { id: item.id } }),
      },
    );
  };

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Add a figure" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.column}>
          <View style={styles.intro}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Add a figure
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              For figures no catalog has, like Hot Toys. Name the character in the title and Fandex
              links it to its universe.
            </ThemedText>
          </View>

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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  content: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  intro: {
    gap: Spacing.one,
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
