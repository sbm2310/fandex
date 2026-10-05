import type { BookCategory } from './category';

/**
 * Publishers (or imprints) that only publish manga or comics. The edition's publisher is the
 * most precise signal we get in search results, so it's checked first.
 */
const MANGA_PUBLISHERS =
  /\b(viz|shonen jump|shōnen jump|kodansha|yen press|seven seas|tokyopop|vertical comics|square enix manga|j-novel)\b/i;
const COMIC_PUBLISHERS =
  /\b(dc comics|marvel|image comics|idw|dark horse comics|boom! studios|oni press|fantagraphics|drawn & quarterly|top shelf|titan comics|dynamite)\b/i;

/**
 * Subjects about a medium rather than in it ("Comic books, strips -- History and criticism")
 * must not make a book about comics count as a comic.
 */
const ABOUT_THE_MEDIUM = /history and criticism|\bcriticism\b|study and teaching|bibliography/i;

const MANGA = /\bmanga\b/i;
const COMIC = /graphic novels?|comic books?|comics & graphic novels|comic strips?|\bcomics\b/i;

/**
 * Open Library merges subjects across all editions of a work, so a novel with a graphic-novel
 * adaptation (The Hobbit: 4 comic subjects out of 93) carries comic subjects too. Comic/manga
 * subjects must make up at least this share of the work's subjects to count.
 */
export const MIN_SUBJECT_SHARE = 0.1;

/**
 * Decides whether an Open Library edition is a book, manga or comic: first from the edition's
 * publisher, then from the share of manga/comic subjects on its work. Manga is checked before
 * comics because manga volumes are usually also tagged as graphic novels. A superhero tag alone
 * doesn't count, since prose superhero novels exist.
 */
export function classifyBookCategory({
  subjects,
  publisher,
}: {
  subjects?: readonly string[] | undefined;
  publisher?: string | undefined;
}): BookCategory {
  if (publisher && MANGA_PUBLISHERS.test(publisher)) return 'manga';
  if (publisher && COMIC_PUBLISHERS.test(publisher)) return 'comic';

  const relevant = (subjects ?? []).filter((subject) => !ABOUT_THE_MEDIUM.test(subject));
  if (relevant.length === 0) return 'book';
  const share = (pattern: RegExp) =>
    relevant.filter((subject) => pattern.test(subject)).length / relevant.length;

  const mangaShare = share(MANGA);
  if (mangaShare > 0 && mangaShare >= MIN_SUBJECT_SHARE) return 'manga';
  if (share(COMIC) >= MIN_SUBJECT_SHARE) return 'comic';
  return 'book';
}
