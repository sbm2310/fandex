import type { AiProviderInfo } from '@fandex/core';
import * as ImagePicker from 'expo-image-picker';

import type { ShelfPhoto } from '@/services/shelf-photo';

/** Picks a photo from the library (the only way on web). */
export async function choosePhoto(onPicked: (photo: ShelfPhoto) => void) {
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset) onPicked({ uri: asset.uri, width: asset.width, height: asset.height });
}

/** Takes a photo with the camera, or picks one when camera access is refused. */
export async function takePhoto(onPicked: (photo: ShelfPhoto) => void) {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return choosePhoto(onPicked);
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset) onPicked({ uri: asset.uri, width: asset.width, height: asset.height });
}

/** Where a scanned photo goes, as the server reports it ("to read the spines", "the box"). */
export function privacyNote(provider: AiProviderInfo | undefined, purpose: string): string {
  if (!provider) return `Your photo is sent to an AI service to ${purpose}.`;
  const where = provider.usesPhotosForTraining
    ? `Your photo is sent to ${provider.name}, an AI service, to ${purpose}. Its free tier may use photos to improve its products, so don't include anything private.`
    : `Your photo is sent to ${provider.name}, an AI service, to ${purpose}. It isn't stored or used to train AI.`;
  return provider.fallbackName
    ? `${where} If it's busy, ${provider.fallbackName} reads the photo instead.`
    : where;
}
