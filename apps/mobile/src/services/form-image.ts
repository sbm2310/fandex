import type { ShelfImage } from './shelf-photo';

/**
 * Adds a JPEG file to a multipart form. React Native's FormData uploads a local file given
 * as `{ uri, name, type }` (no need to read it into memory); browsers need a Blob instead
 * (see form-image.web.ts).
 */
export async function appendJpeg(
  form: FormData,
  field: string,
  image: ShelfImage,
  name: string,
): Promise<void> {
  form.append(field, { uri: image.uri, name, type: 'image/jpeg' } as unknown as Blob);
}
