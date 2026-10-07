import { requestUrl } from "obsidian";
import type { JsonCache } from "./cache";

let cache: JsonCache | null = null;

export function setBibleCache(next: JsonCache | null): void {
  cache = next;
}

export interface Verse {
  number: number;
  text: string;
}

export interface Footnote {
  label: string;
  text: string;
}

export type Language = "de" | "en";

export type QuoteStyle = "bold" | "quote-each" | "prose" | "custom";

export interface BibleSettings {
  translation: string;
  language: string;
  style: QuoteStyle;
  includeSourceLink: boolean;
  footnotes: boolean;
  template: string;
  verseTemplate: string;
  verseSeparator: string;
  parallelTranslations: string;
}

export const DEFAULT_TEMPLATE = "> {heading}\n>\n{verses}";
export const DEFAULT_VERSE_TEMPLATE = "> **{number}** {text}";
export const DEFAULT_VERSE_SEPARATOR = "\\n";

export const DEFAULT_SETTINGS: BibleSettings = {
  translation: "S00",
  language: "de",
  style: "bold",
  includeSourceLink: false,
  footnotes: true,
  template: DEFAULT_TEMPLATE,
  verseTemplate: DEFAULT_VERSE_TEMPLATE,
  verseSeparator: DEFAULT_VERSE_SEPARATOR,
  parallelTranslations: "",
};

const API_BASE = "https://bolls.life";

const BOOK_ALIASES: Record<Language, Record<string, number>> = {
  de: {
    gen: 1, "1mos": 1, genesis: 1,
    ex: 2, "2mos": 2, exodus: 2,
    lev: 3, "3mos": 3, levitikus: 3,
    num: 4, "4mos": 4, numeri: 4,
    dtn: 5, "5mos": 5, deut: 5, deuteronomium: 5,
    jos: 6, josua: 6,
    ri: 7, richt: 7, richter: 7,
    rut: 8, ruth: 8,
    "1sam": 9, "1sm": 9, "2sam": 10, "2sm": 10,
    "1kon": 11, "1konige": 11, "2kon": 12, "2konige": 12,
    "1chr": 13, "1chron": 13, "2chr": 14, "2chron": 14,
    esr: 15, esra: 15,
    neh: 16, nehemia: 16,
    est: 17, ester: 17, esther: 17,
    hi: 18, hiob: 18,
    ps: 19, psa: 19, psalm: 19, psalter: 19,
    spr: 20, sprichw: 20, spruche: 20,
    pred: 21, koh: 21, prediger: 21,
    hld: 22, hoheslied: 22,
    jes: 23, jesaja: 23,
    jer: 24, jeremia: 24,
    klag: 25, klgl: 25, klagelieder: 25,
    hes: 26, ez: 26, hesekiel: 26,
    dan: 27, daniel: 27,
    hos: 28, hosea: 28,
    joel: 29,
    am: 30, amos: 30,
    obd: 31, ob: 31, obadja: 31,
    jona: 32,
    mi: 33, micha: 33,
    nah: 34, nahum: 34,
    hab: 35, habakuk: 35,
    zef: 36, zeph: 36, zephania: 36,
    hag: 37, haggai: 37,
    sach: 38, sacharja: 38,
    mal: 39, maleachi: 39,
    mt: 40, matt: 40, matthaus: 40,
    mk: 41, mark: 41, markus: 41,
    lk: 42, luk: 42, lukas: 42,
    joh: 43, jn: 43, johannes: 43,
    apg: 44, act: 44, apostelgeschichte: 44,
    rom: 45, romer: 45, roem: 45,
    "1kor": 46, "1korinther": 46,
    "2kor": 47, "2korinther": 47,
    gal: 48, galater: 48,
    eph: 49, epheser: 49,
    phil: 50, philipper: 50,
    kol: 51, kolosser: 51,
    "1thess": 52, "1thessalonicher": 52,
    "2thess": 53, "2thessalonicher": 53,
    "1tim": 54, "1timotheus": 54,
    "2tim": 55, "2timotheus": 55,
    tit: 56, titus: 56,
    phlm: 57, philem: 57, philemon: 57,
    hebr: 58, hebraer: 58,
    jak: 59, jakobus: 59,
    "1petr": 60, "1pet": 60, "1petrus": 60,
    "2petr": 61, "2pet": 61, "2petrus": 61,
    "1joh": 62, "1johannes": 62,
    "2joh": 63, "2johannes": 63,
    "3joh": 64, "3johannes": 64,
    jud: 65, judas: 65,
    offb: 66, off: 66, apk: 66, offenbarung: 66,
  },
  en: {
    gen: 1, genesis: 1, ex: 2, exodus: 2,
    lev: 3, num: 4, deut: 5, josh: 6, judg: 7,
    ruth: 8, "1sam": 9, "2sam": 10, "1kgs": 11, "2kgs": 12,
    "1chr": 13, "2chr": 14, ezra: 15, neh: 16, est: 17,
    job: 18, ps: 19, psalm: 19, prov: 20, eccl: 21,
    song: 22, isa: 23, jer: 24, lam: 25, ezek: 26,
    dan: 27, hos: 28, joel: 29, amos: 30, obad: 31,
    jonah: 32, mic: 33, nah: 34, hab: 35, zeph: 36,
    hag: 37, zech: 38, mal: 39, matt: 40, mark: 41,
    luke: 42, john: 43, acts: 44, rom: 45,
    "1cor": 46, "2cor": 47, gal: 48, eph: 49, phil: 50,
    col: 51, "1thess": 52, "2thess": 53, "1tim": 54,
    "2tim": 55, titus: 56, phlm: 57, heb: 58, jas: 59,
    "1pet": 60, "2pet": 61, "1john": 62, "2john": 63,
    "3john": 64, jude: 65, rev: 66,
  },
};

const BOOK_NAMES: Record<Language, string[]> = {
  de: [
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
  ],
  en: [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy",
    "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles",
    "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Songs", "Isaiah", "Jeremiah", "Lamentations",
    "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah",
    "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
    "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts",
    "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians",
    "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews",
    "James", "1 Peter", "2 Peter", "1 John", "2 John",
    "3 John", "Jude", "Revelation",
  ],
};

interface TranslationEntry {
  short_name: string;
  full_name: string;
}

interface TranslationGroup {
  language: string;
  translations?: TranslationEntry[];
}

interface RawBook {
  name: string;
}

interface RawVerse {
  verse: number;
  text: string;
  comment?: string;
}

function aliasLanguage(language: string): Language | null {
  const value = language.toLowerCase();
  if (value === "de" || value.startsWith("german")) return "de";
  if (value === "en" || value.startsWith("english")) return "en";
  return null;
}

function groupMatches(groupLanguage: string | undefined, language: string): boolean {
  if (!groupLanguage) return false;
  const alias = aliasLanguage(language);
  return alias ? aliasLanguage(groupLanguage) === alias : groupLanguage === language;
}

async function getJson(url: string): Promise<unknown> {
  if (cache) {
    const cached = cache.get<unknown>(url);
    if (cached !== undefined) return cached;
  }
  try {
    const response = await requestUrl({ url });
    if (response.status < 200 || response.status >= 300) return null;
    const data = response.json as unknown;
    cache?.set(url, data);
    return data;
  } catch {
    return null;
  }
}

function normalize(input: string): string {
  const map: Record<string, string> = {
    ä: "a", ö: "o", ü: "u", ß: "ss",
    é: "e", è: "e", ê: "e", á: "a", à: "a",
    í: "i", ó: "o", ú: "u", ñ: "n", ç: "c",
  };
  return input
    .toLowerCase()
    .trim()
    .replace(/[\s.]/g, "")
    .split("")
    .map((char) => map[char] ?? char)
    .join("");
}

async function getBooks(translation: string): Promise<string[]> {
  const data = (await getJson(
    `${API_BASE}/get-books/${encodeURIComponent(translation)}/`
  )) as RawBook[] | null;
  return Array.isArray(data) ? data.map((book) => book.name) : [];
}

async function getTranslationGroups(): Promise<TranslationGroup[]> {
  const languages = (await getJson(
    `${API_BASE}/static/bolls/app/views/languages.json`
  )) as TranslationGroup[] | null;
  return Array.isArray(languages) ? languages : [];
}

async function translationName(translation: string): Promise<string> {
  const groups = await getTranslationGroups();
  for (const group of groups) {
    for (const entry of group.translations ?? []) {
      if (entry.short_name === translation) return entry.full_name;
    }
  }
  return translation;
}

export interface TranslationOption {
  short: string;
  full: string;
}

export async function listTranslations(
  language: string
): Promise<TranslationOption[]> {
  const groups = await getTranslationGroups();
  const options: TranslationOption[] = [];
  for (const group of groups) {
    if (!groupMatches(group.language, language)) continue;
    for (const entry of group.translations ?? []) {
      options.push({ short: entry.short_name, full: entry.full_name });
    }
  }
  return options;
}

export interface LanguageOption {
  key: string;
  label: string;
}

export async function listLanguages(): Promise<LanguageOption[]> {
  const groups = await getTranslationGroups();
  return groups
    .filter((group) => group.language)
    .map((group) => ({
      key: aliasLanguage(group.language) ?? group.language,
      label: group.language,
    }));
}

function standardBooks(language: string): string[] | null {
  const alias = aliasLanguage(language);
  return alias ? BOOK_NAMES[alias] : null;
}

function displayBook(number: number, language: string): string {
  const books = standardBooks(language);
  return books?.[number - 1] ?? String(number);
}

function translationBook(
  number: number,
  books: string[],
  language: string
): string {
  return books[number - 1] ?? displayBook(number, language);
}

function matchInList(normalised: string, names: string[]): number | null {
  const prefix: number[] = [];
  names.forEach((name, index) => {
    if (name.startsWith(normalised)) prefix.push(index + 1);
  });
  if (prefix.length === 1) return prefix[0];
  if (prefix.length > 1) return null;

  const subs: number[] = [];
  names.forEach((name, index) => {
    if (name.includes(normalised)) subs.push(index + 1);
  });
  return subs.length === 1 ? subs[0] : null;
}

function resolveBook(
  name: string,
  books: string[],
  language: string
): number | null {
  const normalised = normalize(name);
  const count = books.length;

  if (/^\d+$/.test(normalised)) {
    const n = parseInt(normalised, 10);
    if (n >= 1 && n <= count) return n;
  }

  const alias = aliasLanguage(language);
  if (alias) {
    const hit = BOOK_ALIASES[alias][normalised];
    if (hit !== undefined && hit >= 1 && hit <= count) return hit;
    const byCanonical = matchInList(
      normalised,
      BOOK_NAMES[alias].map(normalize)
    );
    if (byCanonical && byCanonical <= count) return byCanonical;
  }

  const byTranslation = matchInList(normalised, books.map(normalize));
  return byTranslation && byTranslation <= count ? byTranslation : null;
}

export type VerseSpec = Array<[number, number]>;

const REFERENCE_RE =
  /^\s*(.+?)\s+(\d+)(?:\s*[-–—]\s*(\d+))?(?:\s*[,.:]\s*(\d+(?:\s*[-–—]\s*\d+)?(?:\s*[.,]\s*\d+(?:\s*[-–—]\s*\d+)?)*))?\s*$/;

function parseVerseSpec(spec?: string): VerseSpec | null {
  if (!spec || !spec.trim()) return null;
  const parts = spec
    .split(/[.,]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.map((part) => {
    const range = part.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (range) {
      const a = parseInt(range[1], 10);
      const b = parseInt(range[2], 10);
      return [Math.min(a, b), Math.max(a, b)] as [number, number];
    }
    const n = parseInt(part, 10);
    return [n, n] as [number, number];
  });
}

export interface ParsedReference {
  book: string;
  chapter: number;
  chapterEnd: number | null;
  spec: VerseSpec | null;
}

export function parseReference(reference: string): ParsedReference | null {
  const match = reference.match(REFERENCE_RE);
  if (!match) return null;
  const chapterEnd = match[3] ? parseInt(match[3], 10) : null;
  const spec = parseVerseSpec(match[4]);
  if (chapterEnd !== null && spec !== null) return null;
  return {
    book: match[1].trim(),
    chapter: parseInt(match[2], 10),
    chapterEnd,
    spec,
  };
}

function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<f>(?:.|\n)*?<\/f>/g, "")
    .replace(/<sup>(?:.|\n)*?<\/sup>/g, "")
    .replace(/<\/?i>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\d+\]/g, "")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/[\u2009\u00a0]/g, " ")
    .replace(/([.!?]["»«„“”']?)([A-ZÄÖÜ])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

class FootnoteRegistry {
  private count = 0;
  private items: Footnote[] = [];

  add(text: string): string {
    this.count += 1;
    const label = String(this.count);
    this.items.push({ label, text });
    return label;
  }

  all(): Footnote[] {
    return this.items;
  }
}

function cleanFootnote(text: string): string {
  return text
    .replace(
      /<a href=['"]([^'"]+)['"]>((?:.|\n)*?)<\/a>/g,
      (_match, href: string, label: string) => {
        const url = /^https?:\/\//.test(href) ? href : `${API_BASE}${href}`;
        return `[${label}](${url})`;
      }
    )
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[\u2009\u00a0]/g, " ")
    .replace(/([.!?])([A-ZÄÖÜ])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function parseComment(comment: string | undefined): Map<number, string> {
  const bodies = new Map<number, string>();
  if (!comment) return bodies;
  const segments = comment.split(/(?=\u2009?\[\d+\])/);
  for (const segment of segments) {
    const match = segment.match(/^\u2009?\[(\d+)\]\s*([\s\S]*)$/);
    if (!match) continue;
    const number = parseInt(match[1], 10);
    const body = cleanFootnote(match[2]);
    if (body) bodies.set(number, body);
  }
  return bodies;
}

const FOOTNOTE_TOKEN = "\uE000";

function attachFootnotes(
  rawText: string,
  comment: string | undefined,
  registry: FootnoteRegistry,
  includeFootnotes: boolean
): string {
  if (!includeFootnotes) return cleanText(rawText);
  const bodies = parseComment(comment);
  const marked = rawText.replace(/<f>(?:.|\n)*?<\/f>/g, (match) => {
    const marker = match.match(/\[(\d+)\]/);
    if (!marker) return "";
    const body = bodies.get(parseInt(marker[1], 10));
    if (!body) return "";
    return `${FOOTNOTE_TOKEN}${registry.add(body)}${FOOTNOTE_TOKEN}`;
  });
  return cleanText(marked).replace(
    new RegExp(`${FOOTNOTE_TOKEN}([^${FOOTNOTE_TOKEN}]+)${FOOTNOTE_TOKEN}`, "g"),
    "[^$1]"
  );
}

function formatRange(range: [number, number]): string {
  return range[0] === range[1]
    ? String(range[0])
    : `${range[0]}-${range[1]}`;
}

function formatReference(
  book: string,
  chapter: number,
  spec: VerseSpec | null
): string {
  if (!spec) return `${book} ${chapter}`;
  return `${book} ${chapter},${spec.map(formatRange).join(".")}`;
}

async function fetchPassage(
  translation: string,
  book: string,
  chapter: number,
  spec: VerseSpec | null,
  registry: FootnoteRegistry,
  includeFootnotes: boolean
): Promise<Verse[]> {
  const data = (await getJson(
    `${API_BASE}/get-chapter/${encodeURIComponent(
      translation
    )}/${encodeURIComponent(book)}/${chapter}/`
  )) as RawVerse[] | null;
  if (!Array.isArray(data)) {
    throw new Error(`Could not load ${book} ${chapter} (${translation}).`);
  }
  const verses = data;
  const toVerse = (verse: RawVerse): Verse => ({
    number: verse.verse,
    text: attachFootnotes(verse.text, verse.comment, registry, includeFootnotes),
  });

  let passage: Verse[];
  if (!spec) {
    passage = verses.filter((verse) => verse.verse).map(toVerse);
  } else {
    passage = [];
    for (const [first, last] of spec) {
      for (const verse of verses) {
        if (verse.verse && verse.verse >= first && verse.verse <= last) {
          passage.push(toVerse(verse));
        }
      }
    }
  }

  if (passage.length === 0) {
    throw new Error(
      `No verses found for ${book} ${chapter}${
        spec ? `,${spec.map(formatRange).join(".")}` : ""
      } (${translation}).`
    );
  }
  return passage;
}

export interface RenderResult {
  heading: string;
  quote: string;
  footnotes: Footnote[];
}

interface Passage {
  translation: string;
  bookNumber: number;
  bookName: string;
  chapter: number;
  referenceLabel: string;
  translationName: string;
  verses: Verse[];
}

interface TemplateSpec {
  template: string;
  verse: string;
  separator: string;
}

const STYLE_PRESETS: Record<Exclude<QuoteStyle, "custom">, TemplateSpec> = {
  bold: {
    template: "> {heading}\n>\n{verses}",
    verse: "> **{number}** {text}",
    separator: "\n",
  },
  "quote-each": {
    template: "{heading}\n\n{verses}",
    verse: "> **{number}** {text}",
    separator: "\n\n",
  },
  prose: {
    template: "> {heading}\n>\n> {verses}",
    verse: "**{number}** {text}",
    separator: " ",
  },
};

function decodeEscapes(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\t/g, "\t");
}

function applyTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in variables ? variables[key] : match
  );
}

function buildSourceLink(passage: Passage): string {
  const verse =
    passage.verses.length === 1 ? `/${passage.verses[0].number}` : "";
  return `${API_BASE}/${passage.translation}/${passage.bookNumber}/${passage.chapter}${verse}/`;
}

function passageVariables(
  passage: Passage
): Record<string, string> {
  return {
    reference: passage.referenceLabel,
    book: passage.bookName,
    chapter: String(passage.chapter),
    translation: passage.translation,
    translationName: passage.translationName,
    sourceUrl: buildSourceLink(passage),
  };
}

function buildHeading(passage: Passage, settings: BibleSettings): string {
  const label = `**${passage.referenceLabel}** (${passage.translationName})`;
  return settings.includeSourceLink
    ? `[${label}](${buildSourceLink(passage)})`
    : label;
}

function renderPassage(passage: Passage, settings: BibleSettings): string {
  const spec: TemplateSpec =
    settings.style === "custom"
      ? {
          template: settings.template || DEFAULT_TEMPLATE,
          verse: settings.verseTemplate || DEFAULT_VERSE_TEMPLATE,
          separator: decodeEscapes(
            settings.verseSeparator ?? DEFAULT_VERSE_SEPARATOR
          ),
        }
      : STYLE_PRESETS[settings.style] ?? STYLE_PRESETS.bold;

  const base = passageVariables(passage);
  const verses = passage.verses
    .map((verse) =>
      applyTemplate(spec.verse, {
        ...base,
        number: String(verse.number),
        text: verse.text,
      })
    )
    .join(spec.separator);

  return applyTemplate(spec.template, {
    ...base,
    heading: buildHeading(passage, settings),
    verses,
  });
}

async function buildPassage(
  reference: string,
  settings: BibleSettings,
  registry: FootnoteRegistry,
  translation: string = settings.translation
): Promise<Passage> {
  const parsed = parseReference(reference);
  if (!parsed) {
    throw new Error(`Cannot parse reference: ${reference}`);
  }
  if (parsed.chapterEnd !== null) {
    throw new Error(
      `Chapter ranges must be split into single chapters first: ${reference}`
    );
  }

  const books = await getBooks(translation);
  if (books.length === 0) {
    throw new Error(`Could not load the book list for ${translation}.`);
  }

  const number = resolveBook(parsed.book, books, settings.language);
  if (!number) {
    throw new Error(`Unknown or ambiguous book: ${parsed.book}`);
  }

  const bookName = translationBook(number, books, settings.language);
  const referenceLabel = formatReference(bookName, parsed.chapter, parsed.spec);
  const verses = await fetchPassage(
    translation,
    bookName,
    parsed.chapter,
    parsed.spec,
    registry,
    settings.footnotes
  );
  const name = await translationName(translation);

  return {
    translation,
    bookNumber: number,
    bookName,
    chapter: parsed.chapter,
    referenceLabel,
    translationName: name,
    verses,
  };
}

export async function fetchBibleQuote(
  reference: string,
  settings: BibleSettings,
  registry: FootnoteRegistry = new FootnoteRegistry(),
  translation?: string
): Promise<RenderResult> {
  const passage = await buildPassage(reference, settings, registry, translation);
  return {
    heading: `**${passage.referenceLabel}** (${passage.translationName})`,
    quote: renderPassage(passage, settings),
    footnotes: registry.all(),
  };
}

function expandChapterRange(reference: string): string[] {
  const parsed = parseReference(reference);
  if (!parsed || parsed.chapterEnd === null) return [reference];
  const first = Math.min(parsed.chapter, parsed.chapterEnd);
  const last = Math.max(parsed.chapter, parsed.chapterEnd);
  const chapters: string[] = [];
  for (let chapter = first; chapter <= last; chapter += 1) {
    chapters.push(`${parsed.book} ${chapter}`);
  }
  return chapters;
}

export function splitReferences(input: string): string[] {
  const references: string[] = [];
  for (const part of input.split(/[;\n]+/)) {
    const trimmed = part.trim();
    if (trimmed) references.push(...expandChapterRange(trimmed));
  }
  return references;
}

export function parseTranslations(value: string): string[] {
  return value
    .split(/[\s,;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function appendFootnotes(output: string, footnotes: Footnote[]): string {
  if (footnotes.length === 0) return output;
  return (
    output +
    "\n\n" +
    footnotes.map((footnote) => `[^${footnote.label}]: ${footnote.text}`).join("\n")
  );
}

export async function fetchBibleQuotes(
  input: string,
  settings: BibleSettings,
  translations?: string[]
): Promise<string> {
  const references = splitReferences(input);
  if (references.length === 0) {
    throw new Error("No reference given.");
  }
  const targets = Array.from(
    new Set([settings.translation, ...(translations ?? [])])
  ).filter(Boolean);
  const registry = new FootnoteRegistry();
  const blocks: string[] = [];
  for (const translation of targets) {
    const quotes: string[] = [];
    for (const reference of references) {
      const firstFootnote = registry.all().length;
      const { quote } = await fetchBibleQuote(
        reference,
        settings,
        registry,
        translation
      );
      const own = registry.all().slice(firstFootnote);
      quotes.push(appendFootnotes(quote, own));
    }
    blocks.push(quotes.join("\n\n"));
  }
  return blocks.join("\n\n");
}

interface RawSearchHit {
  book: number;
  chapter: number;
  verse: number;
  text: string;
}

export interface SearchSegment {
  text: string;
  highlight: boolean;
}

export interface SearchResult {
  book: number;
  chapter: number;
  verse: number;
  reference: string;
  segments: SearchSegment[];
}

const SEARCH_LIMIT = 100;

function splitHighlight(text: string): SearchSegment[] {
  const cleaned = text
    .replace(/<f>(?:.|\n)*?<\/f>/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<(?!\/?mark\b)[^>]+>/gi, "")
    .replace(/[\u2009\u00a0]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const regex = /<mark>(.*?)<\/mark>/gi;
  const segments: SearchSegment[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(cleaned)) !== null) {
    if (match.index > last) {
      segments.push({ text: cleaned.slice(last, match.index), highlight: false });
    }
    segments.push({ text: match[1], highlight: true });
    last = regex.lastIndex;
  }
  if (last < cleaned.length) {
    segments.push({ text: cleaned.slice(last), highlight: false });
  }
  return segments.length > 0 ? segments : [{ text: cleaned, highlight: false }];
}

export async function searchBible(
  query: string,
  translation: string
): Promise<SearchResult[]> {
  const data = (await getJson(
    `${API_BASE}/find/${encodeURIComponent(translation)}/${encodeURIComponent(
      query
    )}/`
  )) as RawSearchHit[] | null;
  if (!Array.isArray(data)) {
    throw new Error(`Search failed (${translation}).`);
  }
  const books = await getBooks(translation);
  return data.slice(0, SEARCH_LIMIT).map((hit) => ({
    book: hit.book,
    chapter: hit.chapter,
    verse: hit.verse,
    reference: `${books[hit.book - 1] ?? hit.book} ${hit.chapter},${hit.verse}`,
    segments: splitHighlight(hit.text),
  }));
}
