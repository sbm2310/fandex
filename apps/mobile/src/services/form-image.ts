import { File } from 'expo-file-system';

import type { ShelfImage } from './shelf-photo';

/**
 * Adds a JPEG file to a multipart form. On iOS and Android the global `fetch` is Expo's
 * (`expo/fetch`), which uploads `expo-file-system` `File`s but throws on React Native's
 * `{ uri, name, type }` parts ("Unsupported FormDataPart implementation") before sending
 * anything. Browsers need a Blob instead (see form-image.web.ts).
 */
export async function appendJpeg(
  form: FormData,
  field: string,
  image: ShelfImage,
  name: string,
): Promise<void> {
  form.append(field, new File(image.uri) as unknown as Blob, name);
}
