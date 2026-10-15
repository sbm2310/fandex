/**
 * First letters of the first two words, as a monogram: "Darth Vader" → "DV", "Gandalf" → "G".
 * A part in brackets is left out ("Aragorn (The Fellowship of the Ring)" → "A"), and so are
 * words that don't start with a letter or digit.
 */
export function initials(name: string): string {
  return name
    .replace(/\s*[([].*$/, '')
    .split(/\s+/)
    .filter((word) => /^[\p{L}\p{N}]/u.test(word))
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
}
