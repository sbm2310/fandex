import { isBookBarcode, parseIsbn } from '@fandex/core';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const REJECTED_HINT_MS = 2000;

/** Full-screen barcode scanner. Hands a scanned ISBN back to the Add screen. */
export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions();

  // Still asking the OS for the current permission status.
  if (!permission) return <View style={styles.black} />;

  if (!permission.granted) {
    return (
      <PermissionPrompt
        canAskAgain={permission.canAskAgain}
        onAllow={() => void requestPermission()}
      />
    );
  }

  return <Scanner />;
}

function Scanner() {
  // The camera reports the same code many times per second; a ref guards synchronously.
  const handled = useRef(false);
  const [rejectedAt, setRejectedAt] = useState<number | null>(null);

  function onBarcodeScanned({ data }: BarcodeScanningResult) {
    if (handled.current) return;

    // Book barcodes are EAN-13 codes in the 978/979 range; DVDs, toys etc. are rejected.
    const isbn = isBookBarcode(data) ? parseIsbn(data) : null;
    if (!isbn) {
      const now = Date.now();
      setRejectedAt(now);
      setTimeout(
        () => setRejectedAt((current) => (current === now ? null : current)),
        REJECTED_HINT_MS,
      );
      return;
    }

    handled.current = true;
    // `scan` makes every scan a new navigation, so re-scanning the same book still triggers a lookup.
    router.dismissTo({ pathname: '/add', params: { isbn, scan: String(Date.now()) } });
  }

  return (
    <View style={styles.black}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
        onBarcodeScanned={onBarcodeScanned}
      />
      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.hintBox}>
          <ThemedText type="smallBold" style={styles.lightText}>
            {rejectedAt
              ? "That's not a book barcode"
              : 'Point at the barcode on the back of a book'}
          </ThemedText>
        </View>
        <View style={styles.frame} accessibilityElementsHidden importantForAccessibility="no" />
        <CancelButton />
      </SafeAreaView>
    </View>
  );
}

function PermissionPrompt({ canAskAgain, onAllow }: { canAskAgain: boolean; onAllow: () => void }) {
  const colors = useTheme();

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.prompt}>
        <ThemedText type="subtitle" style={styles.centeredText}>
          Scan book barcodes
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.centeredText}>
          {canAskAgain
            ? 'Fandex needs your camera to read the barcode on the back of a book. Photos are never taken or stored.'
            : 'Camera access is turned off for Fandex. You can turn it on in Settings.'}
        </ThemedText>
        <Pressable
          accessibilityRole="button"
          onPress={canAskAgain ? onAllow : () => void Linking.openSettings()}
          style={({ pressed }) => [
            styles.primaryButton,
            { backgroundColor: colors.accent },
            pressed && styles.pressed,
          ]}
        >
          <ThemedText type="smallBold" themeColor="onAccent">
            {canAskAgain ? 'Allow camera access' : 'Open Settings'}
          </ThemedText>
        </Pressable>
        <CancelButton subtle />
      </SafeAreaView>
    </ThemedView>
  );
}

function CancelButton({ subtle = false }: { subtle?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/add'))}
      hitSlop={12}
      style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
    >
      <ThemedText
        type="smallBold"
        themeColor={subtle ? 'textSecondary' : undefined}
        style={!subtle && styles.lightText}
      >
        Cancel
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  black: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
  },
  hintBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  frame: {
    width: '80%',
    aspectRatio: 2,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: Spacing.three,
  },
  lightText: {
    color: '#fff',
  },
  prompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centeredText: {
    textAlign: 'center',
  },
  primaryButton: {
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.five,
  },
  cancel: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  pressed: {
    opacity: 0.7,
  },
});
