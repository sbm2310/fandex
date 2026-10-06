/**
 * Name and phrase normalization for universe matching. Sources spell the same name many ways
 * ("Middle-earth", "Middle Earth (Imaginary place)", "Glóin (Gloin)", "Skywalker, Luke"), so
 * every comparison happens on normalized text: lowercase ASCII words separated by single spaces.
 */

/** "Glóin's Spider-Man!" → "gloins spider man". */
export function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // accents: "Théoden" → "Theoden"
    .toLowerCase()
    .replace(/['’]/g, '') // "Ra's" → "ras", not "ra s"
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Normalized and without a leading "the", so "The Joker" and "Joker" compare equal. */
export function normalizeName(value: string): string {
  return normalizeText(value).replace(/^the /, '');
}

/** True if `phrase` appears in `text` as whole words (both already normalized). */
export function containsPhrase(text: string, phrase: string): boolean {
  return phrase.length > 0 && ` ${text} `.includes(` ${phrase} `);
}

const PARENTHESES = /\s*\([^)]*\)/g;

/**
 * A character name from Open Library ("Batman (Fictitious character)", "Skywalker, Luke",
 * "J. R. R. Tolkien (1892-1973)"): parentheses dropped, "Last, First" turned around.
 */
export function cleanPersonName(raw: string): string {
  const name = raw.replace(PARENTHESES, '').trim();
  const parts = name.split(',').map((part) => part.trim());
  if (parts.length === 2 && parts[0] && parts[1]) return normalizeName(`${parts[1]} ${parts[0]}`);
  return normalizeName(name);
}

/**
 * The character names in a Rebrickable minifig name, which adds outfit details after a dash,
 * a comma or "with" ("Gandalf The Grey - Cape, Hat", "Han Solo, Old, Angry", "The Joker with
 * Green Vest") and sometimes lists two names ("Dr. Octopus / Doc Ock").
 */
export function cleanMinifigNames(raw: string): string[] {
  const name = raw.split(/\s+-\s+|,|\s+with\s+/i)[0] ?? '';
  return name
    .replace(PARENTHESES, '')
    .split('/')
    .map(normalizeName)
    .filter((part) => part.length > 0);
}

/** A place name: parentheses dropped ("Hogwarts (Imaginary place)" → "hogwarts"). */
export function cleanPlaceName(raw: string): string {
  return normalizeName(raw.replace(PARENTHESES, ''));
}

const CHARACTER_SUBJECT = /^(.+?)\s*\((?:fictitious|fictional) characters?\)$/i;
const PLACE_SUBJECT = /^(.+?)\s*\((?:imaginary|fictitious|fictional) place\)$/i;

/**
 * Open Library subjects that name a character or a place: "Gandalf (Fictitious character)",
 * "Middle Earth (Imaginary place)". Only this exact form counts; the lowercase
 * "Baggins, frodo (fictitious character), fiction" variants are merged from other editions
 * and works (The Hobbit carries Frodo that way), so they're too noisy to name characters.
 */
export function parseSubject(subject: string): { person: string } | { place: string } | null {
  const person = CHARACTER_SUBJECT.exec(subject.trim());
  if (person?.[1]) return { person: cleanPersonName(person[1]) };
  const place = PLACE_SUBJECT.exec(subject.trim());
  if (place?.[1]) return { place: normalizeName(place[1]) };
  return null;
}

/** A subject as plain text for phrase matching: parentheses dropped ("Hobbits (…)" → "hobbits"). */
export function subjectText(subject: string): string {
  return normalizeText(subject.replace(PARENTHESES, ' '));
}
