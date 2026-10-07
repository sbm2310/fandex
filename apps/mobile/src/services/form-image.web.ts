import type { ShelfImage } from './shelf-photo';

/** Browsers: the image is a blob or data URL; fetch it as a Blob for the multipart form. */
export async function appendJpeg(
  form: FormData,
  field: string,
  image: ShelfImage,
  name: string,
): Promise<void> {
  const blob = await (await fetch(image.uri)).blob();
  form.append(field, new Blob([blob], { type: 'image/jpeg' }), name);
}
