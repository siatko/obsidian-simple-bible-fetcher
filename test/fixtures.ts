import type { RequestUrlHandler, RequestUrlResponse } from "./obsidian-stub";

export const GERMAN_BOOKS = [
  "1. Mose", "2. Mose", "3. Mose", "4. Mose", "5. Mose",
  "Josua", "Richter", "Ruth", "1. Samuel", "2. Samuel",
  "1. Könige", "2. Könige", "1. Chronik", "2. Chronik",
  "Esra", "Nehemia", "Esther", "Hiob", "Psalm", "Sprüche",
  "Prediger", "Hoheslied", "Jesaja", "Jeremia", "Klagelieder",
  "Hesekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadja", "Jona",
  "Micha", "Nahum", "Habakuk", "Zefanja", "Haggai", "Sacharja",
  "Maleachi",
  "Matthäus", "Markus", "Lukas", "Johannes", "Apostelgeschichte",
  "Römer", "1. Korinther", "2. Korinther", "Galater", "Epheser",
  "Philipper", "Kolosser", "1. Thessalonicher", "2. Thessalonicher",
  "1. Timotheus", "2. Timotheus", "Titus", "Philemon", "Hebräer",
  "Jakobus", "1. Petrus", "2. Petrus", "1. Johannes", "2. Johannes",
  "3. Johannes", "Judas", "Offenbarung",
];

export interface RawVerseFixture {
  verse: number;
  text: string;
  comment?: string;
}

export interface RawSearchHitFixture {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface TranslationEntryFixture {
  short_name: string;
  full_name: string;
}

export interface TranslationGroupFixture {
  language: string;
  translations?: TranslationEntryFixture[];
}

export const DEFAULT_LANGUAGES: TranslationGroupFixture[] = [
  {
    language: "German",
    translations: [
      { short_name: "S00", full_name: "Schlachter 2000" },
      { short_name: "LUT", full_name: "Luther (1912)" },
      { short_name: "ELB", full_name: "Elberfelder Bibel, 1871" },
    ],
  },
  {
    language: "English",
    translations: [
      { short_name: "BSB", full_name: "Berean Standard Bible" },
    ],
  },
];

export const DEFAULT_CHAPTER: RawVerseFixture[] = [
  { verse: 1, text: "Am Anfang schuf Gott Himmel und Erde." },
  { verse: 2, text: "Und die Erde war wüst und leer." },
  {
    verse: 16,
    text:
      "Denn so <f>[1]</f> hat Gott die Welt geliebt, dass er seinen eingeborenen Sohn gab; Gott!Erleuchte uns [ertönt].",
    comment: "\u2009[1] andere übersetzen: <a href='/S00/43/3/16'>so</a>.",
  },
  { verse: 17, text: "Denn Gott hat seinen Sohn nicht gesandt, zu richten." },
  {
    verse: 18,
    text: "Wer an ihn glaubt, wird nicht gerichtet.<f>[2]</f>",
    comment: "\u2009[2] vgl. <a href='/S00/43/1/29'>Fn.</a>.",
  },
];

export const DEFAULT_SEARCH: RawSearchHitFixture[] = [
  {
    book: 43,
    chapter: 3,
    verse: 16,
    text: "Denn so hat Gott die <mark>Liebe</mark> zu uns bewiesen.",
  },
  {
    book: 62,
    chapter: 4,
    verse: 11,
    text: "Geliebte, so sind wir es schuldig, einander zu <mark>liebe</mark>n.",
  },
];

export interface ApiOverrides {
  languages?: TranslationGroupFixture[];
  books?: Record<string, string[]>;
  booksJson?: Record<string, unknown>;
  chapters?: Record<string, RawVerseFixture[]>;
  search?: Record<string, RawSearchHitFixture[]>;
  fail?: (url: string) => boolean;
}

export interface FakeApi {
  requests: string[];
  handler: RequestUrlHandler;
}

function ok(json: unknown): RequestUrlResponse {
  return { status: 200, json };
}

export function createApi(overrides: ApiOverrides = {}): FakeApi {
  const requests: string[] = [];
  const languages = overrides.languages ?? DEFAULT_LANGUAGES;

  const handler: RequestUrlHandler = async ({ url }) => {
    requests.push(url);

    if (overrides.fail?.(url)) return { status: 500, json: null };

    if (url.endsWith("/views/languages.json")) {
      return ok(languages);
    }

    const booksMatch = url.match(/\/get-books\/([^/]+)\/$/);
    if (booksMatch) {
      const translation = decodeURIComponent(booksMatch[1]);
      if (overrides.booksJson?.[translation] !== undefined) {
        return ok(overrides.booksJson[translation]);
      }
      const names = overrides.books?.[translation] ?? GERMAN_BOOKS;
      return ok(names.map((name) => ({ name })));
    }

    const chapterMatch = url.match(/\/get-chapter\/([^/]+)\/([^/]+)\/(\d+)\/$/);
    if (chapterMatch) {
      const translation = decodeURIComponent(chapterMatch[1]);
      const book = decodeURIComponent(chapterMatch[2]);
      const chapter = chapterMatch[3];
      return ok(
        overrides.chapters?.[`${translation}/${book}/${chapter}`] ??
          DEFAULT_CHAPTER
      );
    }

    const searchMatch = url.match(/\/find\/([^/]+)\/([^/]+)\/$/);
    if (searchMatch) {
      const translation = decodeURIComponent(searchMatch[1]);
      const query = decodeURIComponent(searchMatch[2]);
      return ok(
        overrides.search?.[`${translation}/${query}`] ?? DEFAULT_SEARCH
      );
    }

    return { status: 404, json: null };
  };

  return { requests, handler };
}
