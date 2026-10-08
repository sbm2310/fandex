import { formatTitle } from '@fandex/core';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EntryRow } from '@/components/entry-row';
import { PageTitle } from '@/components/page-title';
import { SearchField } from '@/components/search-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAsk } from '@/hooks/use-ask';
import { useTheme } from '@/hooks/use-theme';
import { EXAMPLE_QUESTIONS, type AskResult } from '@/utils/ask';

/**
 * "Ask your collection": a question in, an answer sentence and the matching items out.
 * Signed in, AI turns the question into a search on the server; otherwise (or offline)
 * keyword matching answers on the device, and the screen says which.
 */
export default function AskScreen() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [question, setQuestion] = useState(params.q ?? '');
  const ask = useAsk();

  const submit = (text = question) => {
    const trimmed = text.trim();
    if (!trimmed || ask.isPending || !ask.ready) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  };

  return (
    <ThemedView style={styles.fill}>
      <PageTitle title="Ask your collection" />
      <View style={styles.column}>
        <View style={styles.askRow}>
          <View style={styles.fill}>
            <SearchField
              value={question}
              onChangeText={setQuestion}
              onSubmitEditing={() => submit()}
              placeholder="What Batman stuff do I own?"
              accessibilityLabel="Your question"
              autoFocus={!params.q}
            />
          </View>
          <Button
            label="Ask"
            onPress={() => submit()}
            disabled={!question.trim() || !ask.ready}
            busy={ask.isPending}
          />
        </View>

        {!ask.ready ? (
          <ActivityIndicator accessibilityLabel="Loading your collection" />
        ) : ask.isPending ? (
          <View style={styles.thinking}>
            <ActivityIndicator accessibilityLabel="Thinking" />
            <ThemedText themeColor="textSecondary">Looking through your collection…</ThemedText>
          </View>
        ) : ask.data ? (
          <Answer result={ask.data} />
        ) : (
          <Examples onPick={submit} />
        )}
      </View>
    </ThemedView>
  );
}

function Examples({ onPick }: { onPick: (question: string) => void }) {
  const colors = useTheme();
  return (
    <View style={styles.examples}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        Try asking
      </ThemedText>
      {EXAMPLE_QUESTIONS.map((example) => (
        <Pressable
          key={example}
          accessibilityRole="button"
          accessibilityLabel={`Ask: ${example}`}
          onPress={() => onPick(example)}
          style={({ pressed }) => [
            styles.example,
            { borderColor: colors.border },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText>{example}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

function Answer({ result }: { result: AskResult }) {
  return (
    <FlatList
      data={result.items}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.answer}>
          <ThemedText type="subtitle" accessibilityRole="header" accessibilityLiveRegion="polite">
            {result.answer}
          </ThemedText>
          {result.notice ? (
            <ThemedText type="small" themeColor="textSecondary">
              {result.notice}
            </ThemedText>
          ) : null}
          {result.method === 'ai' && result.questionsLeft !== undefined ? (
            <ThemedText type="small" themeColor="textSecondary">
              {result.questionsLeft === 1
                ? '1 AI question left today'
                : `${result.questionsLeft} AI questions left today`}
            </ThemedText>
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <Link href={{ pathname: '/book/[id]', params: { id: item.id } }} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Open ${formatTitle(item.catalog)}`}
            style={styles.item}
          >
            <EntryRow entry={item.catalog} showUniverses={false} />
          </Pressable>
        </Link>
      )}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.three,
  },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  thinking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  examples: {
    gap: Spacing.two,
  },
  example: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
  answer: {
    gap: Spacing.one,
    paddingBottom: Spacing.three,
  },
  list: {
    paddingBottom: Spacing.four,
  },
  item: {
    paddingVertical: Spacing.two,
  },
});
