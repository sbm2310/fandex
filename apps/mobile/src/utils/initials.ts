/** First letters of the first two words, as a monogram: "Darth Vader" → "DV", "Gandalf" → "G". */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
