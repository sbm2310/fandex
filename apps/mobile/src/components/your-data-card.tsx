import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCollection } from '@/hooks/use-collection';
import { usePreorders } from '@/hooks/use-preorders';
import { useTheme } from '@/hooks/use-theme';
import { collectionCsv, collectionJson, exportFileName, type ExportFormat } from '@/utils/export';
import { saveExport } from '@/utils/save-export';
import { localToday } from '@/utils/today';

const itemsText = (count: number) => (count === 1 ? '1 item' : `${count} items`);

/** Take your collection with you: JSON (everything, pre-orders too) or CSV (for spreadsheets). */
export function YourDataCard() {
  const colors = useTheme();
  const collection = useCollection();
  const preorders = usePreorders();
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const items = collection.data;
  // Signed in, the JSON file includes pre-orders, so it waits for them too.
  const preordersReady = !preorders.signedIn || preorders.isSuccess;
  const ready = !!items && !preorders.userPending && preordersReady;
  const where = collection.mode === 'device' ? ' on this device' : ' in your account';

  async function exportAs(format: ExportFormat) {
    if (!items) return;
    setBusy(format);
    setProblem(null);
    try {
      const content =
        format === 'json'
          ? collectionJson(items, preorders.data ?? [], new Date())
          : collectionCsv(items);
      await saveExport(exportFileName(format, localToday()), content, format);
    } catch (error) {
      setProblem(
        `Couldn't export your collection. ${error instanceof Error ? error.message : ''}`.trim(),
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card style={styles.card}>
      <ThemedText type="section">Your data</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {items?.length === 0
          ? 'Nothing to export yet: add something to your collection first.'
          : `${items ? `${itemsText(items.length)}${where}. ` : ''}JSON keeps everything${
              preorders.signedIn ? ', pre-orders too' : ''
            }; CSV opens in a spreadsheet.`}
      </ThemedText>
      {preorders.signedIn && preorders.isError && (
        <ThemedText type="small" themeColor="textSecondary" accessibilityRole="alert">
          Couldn&apos;t load your pre-orders, so the JSON file has to wait. CSV works.
        </ThemedText>
      )}
      <View style={styles.buttons}>
        <Button
          label="Export as JSON"
          variant="secondary"
          busy={busy === 'json'}
          disabled={!ready || busy !== null || items.length === 0}
          onPress={() => void exportAs('json')}
        />
        <Button
          label="Export as CSV"
          variant="secondary"
          busy={busy === 'csv'}
          disabled={!items || busy !== null || items.length === 0}
          onPress={() => void exportAs('csv')}
        />
      </View>
      {problem && (
        <ThemedText type="small" accessibilityRole="alert" style={{ color: colors.danger }}>
          {problem}
        </ThemedText>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
  },
  buttons: {
    gap: Spacing.two,
  },
});
