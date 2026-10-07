import { beforeEach, describe, expect, it } from "vitest";
import {
  BibleSettings,
  DEFAULT_SETTINGS,
  fetchBibleQuote,
  fetchBibleQuotes,
  listLanguages,
  listTranslations,
  parseReference,
  QuoteStyle,
  searchBible,
  setBibleCache,
  splitReferences,
} from "../src/bible";
import { JsonCache } from "../src/cache";
import { setRequestUrlHandler } from "./obsidian-stub";
import { createApi, DEFAULT_CHAPTER, GERMAN_BOOKS } from "./fixtures";

function settings(overrides: Partial<BibleSettings> = {}): BibleSettings {
  return { ...DEFAULT_SETTINGS, ...overrides };
}

function useApi(api = createApi()): ReturnType<typeof createApi> {
  setRequestUrlHandler(api.handler);
  return api;
}

describe("parseReference", () => {
  it("parses a single verse", () => {
    expect(parseReference("Johannes 3:16")).toEqual({
      book: "Johannes",
      chapter: 3,
      chapterEnd: null,
      spec: [[16, 16]],
    });
  });

  it("accepts a comma as the chapter separator", () => {
    expect(parseReference("Johannes 3,16")?.spec).toEqual([[16, 16]]);
  });

  it("parses a verse range", () => {
    expect(parseReference("Johannes 3:16-18")?.spec).toEqual([[16, 18]]);
  });

  it("normalises a reversed range", () => {
    expect(parseReference("Johannes 3:18-16")?.spec).toEqual([[16, 18]]);
  });

  it("parses several single verses", () => {
    expect(parseReference("Johannes 3:16.18")?.spec).toEqual([
      [16, 16],
      [18, 18],
    ]);
  });

  it("parses a whole chapter without a verse spec", () => {
    expect(parseReference("Psalm 23")).toEqual({
      book: "Psalm",
      chapter: 23,
      chapterEnd: null,
      spec: null,
    });
  });

  it("parses a chapter range", () => {
    expect(parseReference("Psalm 3-5")).toEqual({
      book: "Psalm",
      chapter: 3,
      chapterEnd: 5,
      spec: null,
    });
  });

  it("rejects a chapter range combined with a verse spec", () => {
    expect(parseReference("Psalm 3-5:2")).toBeNull();
  });

  it("returns null for input without a chapter", () => {
    expect(parseReference("Johannes")).toBeNull();
  });
});

describe("splitReferences", () => {
  it("splits on semicolons and newlines and drops blanks", () => {
    expect(splitReferences("a; b\nc;; d")).toEqual(["a", "b", "c", "d"]);
  });

  it("expands a chapter range into single chapters", () => {
    expect(splitReferences("Psalm 3-5")).toEqual([
      "Psalm 3",
      "Psalm 4",
      "Psalm 5",
    ]);
  });

  it("normalises a reversed chapter range", () => {
    expect(splitReferences("Psalm 5-3")).toEqual([
      "Psalm 3",
      "Psalm 4",
      "Psalm 5",
    ]);
  });
});

describe("fetchBibleQuote", () => {
  it("renders the heading, verse and inline footnote", async () => {
    useApi();
    const result = await fetchBibleQuote("Johannes 3:16", settings());

    expect(result.heading).toBe("**Johannes 3,16** (Schlachter 2000)");
    expect(result.quote.split("\n")[0]).toBe(
      "> **Johannes 3,16** (Schlachter 2000)"
    );
    expect(result.quote).toContain("> **16** Denn so [^1] hat Gott");
    expect(result.quote).toContain("Gott! Erleuchte uns \\[ertönt\\].");
    expect(result.footnotes).toEqual([
      {
        label: "1",
        text: "andere übersetzen: [so](https://bolls.life/S00/43/3/16).",
      },
    ]);
  });

  it("strips footnotes and markup when disabled", async () => {
    useApi();
    const result = await fetchBibleQuote(
      "Johannes 3:16",
      settings({ footnotes: false })
    );

    expect(result.quote).not.toContain("[^1]");
    expect(result.quote).toContain("Denn so hat Gott die Welt geliebt");
    expect(result.quote).toContain("\\[ertönt\\]");
    expect(result.footnotes).toEqual([]);
  });

  it("links the heading to bolls.life when enabled", async () => {
    useApi();
    const result = await fetchBibleQuote(
      "Johannes 3:16",
      settings({ includeSourceLink: true })
    );

    expect(result.quote.split("\n")[0]).toBe(
      "> [**Johannes 3,16** (Schlachter 2000)](https://bolls.life/S00/43/3/16/)"
    );
  });

  it("resolves book abbreviations", async () => {
    const api = useApi();
    await fetchBibleQuote("Joh 3:16", settings());
    expect(
      api.requests.some((url) => url.includes("/get-chapter/S00/Johannes/3/"))
    ).toBe(true);
  });

  it("resolves a book given by number", async () => {
    const api = useApi();
    await fetchBibleQuote("43 3:16", settings());
    expect(
      api.requests.some((url) => url.includes("/get-chapter/S00/Johannes/3/"))
    ).toBe(true);
  });

  it("rejects an unknown book", async () => {
    useApi();
    await expect(fetchBibleQuote("Zzyzx 1:1", settings())).rejects.toThrow(
      /Unknown or ambiguous book/
    );
  });

  it("rejects an ambiguous book name", async () => {
    useApi();
    await expect(fetchBibleQuote("K 1:1", settings())).rejects.toThrow(
      /Unknown or ambiguous book/
    );
  });

  it("fails when the book list is empty", async () => {
    useApi(createApi({ books: { S00: [] } }));
    await expect(fetchBibleQuote("Johannes 3:16", settings())).rejects.toThrow(
      /Could not load the book list/
    );
  });

  it("fails when the chapter cannot be loaded", async () => {
    useApi(createApi({ fail: (url) => url.includes("/get-chapter/") }));
    await expect(fetchBibleQuote("Johannes 3:16", settings())).rejects.toThrow(
      /Could not load Johannes 3/
    );
  });

  it("fails when the requested verse is missing", async () => {
    useApi(createApi({ chapters: { "S00/Johannes/3": [] } }));
    await expect(fetchBibleQuote("Johannes 3:16", settings())).rejects.toThrow(
      /No verses found for Johannes 3,16/
    );
  });

  it("uses the translation's own book name for the label", async () => {
    useApi();
    const result = await fetchBibleQuote("Johannes 3:16", settings());
    expect(result.heading).toContain("Johannes");
    expect(GERMAN_BOOKS[42]).toBe("Johannes");
  });

  it("formats a verse range in the label", async () => {
    useApi();
    const result = await fetchBibleQuote("Johannes 3:16-18", settings());
    expect(result.heading).toBe("**Johannes 3,16-18** (Schlachter 2000)");
  });

  it("rejects an unparseable reference", async () => {
    useApi();
    await expect(fetchBibleQuote("nonsense", settings())).rejects.toThrow(
      /Cannot parse reference/
    );
  });

  it("rejects a chapter range passed directly to fetchBibleQuote", async () => {
    useApi();
    await expect(fetchBibleQuote("Psalm 3-5", settings())).rejects.toThrow(
      /Chapter ranges must be split/
    );
  });

  it("falls back to the translation code when the name is unknown", async () => {
    useApi();
    const result = await fetchBibleQuote(
      "Johannes 3:16",
      settings({ translation: "XXX" })
    );
    expect(result.heading).toContain("(XXX)");
  });
});

describe("output formats", () => {
  const chapterOnly = () =>
    useApi(
      createApi({
        chapters: {
          "S00/Johannes/3": [
            { verse: 1, text: "A" },
            { verse: 2, text: "B" },
          ],
        },
      })
    );

  it("renders the bold preset", async () => {
    chapterOnly();
    const result = await fetchBibleQuote("Johannes 3", settings());
    expect(result.quote).toBe(
      [
        "> **Johannes 3** (Schlachter 2000)",
        ">",
        "> **1** A",
        "> **2** B",
      ].join("\n")
    );
  });

  it("renders the one-blockquote-per-verse preset", async () => {
    chapterOnly();
    const result = await fetchBibleQuote(
      "Johannes 3",
      settings({ style: "quote-each" })
    );
    expect(result.quote).toBe(
      [
        "**Johannes 3** (Schlachter 2000)",
        "",
        "> **1** A",
        "",
        "> **2** B",
      ].join("\n")
    );
  });

  it("renders the running-text preset", async () => {
    chapterOnly();
    const result = await fetchBibleQuote(
      "Johannes 3",
      settings({ style: "prose" })
    );
    expect(result.quote).toBe(
      "> **Johannes 3** (Schlachter 2000)\n>\n> **1** A **2** B"
    );
  });

  it("renders a custom template with placeholders", async () => {
    chapterOnly();
    const result = await fetchBibleQuote(
      "Johannes 3",
      settings({
        style: "custom",
        template:
          "HEAD {reference} / {translation} ({translationName})\n--\n{verses}\n--\nsource:{sourceUrl}",
        verseTemplate: "{number}: {text}",
        verseSeparator: " | ",
      })
    );
    expect(result.quote).toBe(
      [
        "HEAD Johannes 3 / S00 (Schlachter 2000)",
        "--",
        "1: A | 2: B",
        "--",
        "source:https://bolls.life/S00/43/3/",
      ].join("\n")
    );
  });

  it("decodes escaped newlines in the verse separator", async () => {
    chapterOnly();
    const result = await fetchBibleQuote(
      "Johannes 3",
      settings({
        style: "custom",
        template: "{verses}",
        verseTemplate: "{number}={text}",
        verseSeparator: "\\n",
      })
    );
    expect(result.quote).toBe("1=A\n2=B");
  });

  it("leaves unknown placeholders untouched", async () => {
    chapterOnly();
    const result = await fetchBibleQuote(
      "Johannes 3",
      settings({ style: "custom", template: "{nope}", verseTemplate: "{text}" })
    );
    expect(result.quote).toBe("{nope}");
  });
});

describe("fetchBibleQuotes", () => {
  it("appends each reference's footnotes to that section", async () => {
    useApi();
    const output = await fetchBibleQuotes(
      "Johannes 3:16; Johannes 3:18",
      settings()
    );

    const firstSection = output.indexOf("> **Johannes 3,16**");
    const firstFootnote = output.indexOf("[^1]: andere übersetzen");
    const secondSection = output.indexOf("> **Johannes 3,18**");
    const secondFootnote = output.indexOf("[^2]: vgl.");

    expect(firstSection).toBeGreaterThanOrEqual(0);
    expect(firstFootnote).toBeGreaterThan(firstSection);
    expect(secondSection).toBeGreaterThan(firstFootnote);
    expect(secondFootnote).toBeGreaterThan(secondSection);
  });

  it("expands a chapter range into one section per chapter", async () => {
    useApi();
    const output = await fetchBibleQuotes("Psalm 3-5", settings());

    const third = output.indexOf("> **Psalm 3**");
    const secondFootnote = output.indexOf("[^2]:");
    const fourth = output.indexOf("> **Psalm 4**");
    const thirdFootnote = output.indexOf("[^3]:");
    const fifth = output.indexOf("> **Psalm 5**");

    expect(third).toBeGreaterThanOrEqual(0);
    expect(secondFootnote).toBeGreaterThan(third);
    expect(fourth).toBeGreaterThan(secondFootnote);
    expect(thirdFootnote).toBeGreaterThan(fourth);
    expect(fifth).toBeGreaterThan(thirdFootnote);
  });

  it("rejects empty input", async () => {
    useApi();
    await expect(fetchBibleQuotes("   ", settings())).rejects.toThrow(
      /No reference given/
    );
  });

  it("always includes the main translation when comparing", async () => {
    useApi();
    const output = await fetchBibleQuotes("Johannes 3:16", settings(), ["LUT"]);

    const s00 = output.indexOf("Schlachter 2000");
    const firstFootnote = output.indexOf("[^1]:");
    const lut = output.indexOf("Luther (1912)");
    const secondFootnote = output.indexOf("[^2]:");

    expect(s00).toBeGreaterThanOrEqual(0);
    expect(firstFootnote).toBeGreaterThan(s00);
    expect(lut).toBeGreaterThan(firstFootnote);
    expect(secondFootnote).toBeGreaterThan(lut);
  });

  it("does not repeat a translation that is both main and listed", async () => {
    useApi();
    const output = await fetchBibleQuotes("Johannes 3:16", settings(), [
      "LUT",
      "S00",
      "LUT",
    ]);

    expect(output.match(/Schlachter 2000/g)).toHaveLength(1);
    expect(output.match(/Luther \(1912\)/g)).toHaveLength(1);
  });

  it("reuses fetched data through the cache", async () => {
    let value: string | null = null;
    const storage = {
      async read() {
        return value;
      },
      async write(data: string) {
        value = data;
      },
    };
    setBibleCache(new JsonCache(storage));

    const api = useApi();
    await fetchBibleQuote("Johannes 3:16", settings());
    const afterFirst = api.requests.length;

    await fetchBibleQuote("Johannes 3:16", settings());
    expect(api.requests.length).toBe(afterFirst);
  });
});

describe("searchBible", () => {
  it("returns references and highlighted segments", async () => {
    useApi();
    const results = await searchBible("Liebe", "S00");

    expect(results).toHaveLength(2);
    expect(results[0].reference).toBe("Johannes 3,16");
    expect(results[0].segments).toEqual([
      { text: "Denn so hat Gott die ", highlight: false },
      { text: "Liebe", highlight: true },
      { text: " zu uns bewiesen.", highlight: false },
    ]);
    expect(results[1].reference).toBe("1. Johannes 4,11");
    expect(results[1].segments.some((s) => s.highlight)).toBe(true);
  });

  it("strips markup that is not a highlight", async () => {
    useApi(
      createApi({
        search: {
          "S00/x": [
            { book: 1, chapter: 1, verse: 1, text: "a <f>note</f> b <i>c</i> d" },
          ],
        },
      })
    );
    const results = await searchBible("x", "S00");
    expect(results[0].segments).toEqual([
      { text: "a b c d", highlight: false },
    ]);
  });

  it("limits the number of results", async () => {
    useApi(
      createApi({
        search: {
          "S00/x": Array.from({ length: 150 }, (_, index) => ({
            book: 1,
            chapter: 1,
            verse: index + 1,
            text: `text ${index}`,
          })),
        },
      })
    );
    const results = await searchBible("x", "S00");
    expect(results).toHaveLength(100);
  });

  it("throws when the search request fails", async () => {
    useApi(createApi({ fail: (url) => url.includes("/find/") }));
    await expect(searchBible("Liebe", "S00")).rejects.toThrow(
      /Search failed \(S00\)/
    );
  });
});

describe("languages and translations", () => {
  beforeEach(() => {
    useApi();
  });

  it("lists languages by alias key", async () => {
    expect(await listLanguages()).toEqual([
      { key: "de", label: "German" },
      { key: "en", label: "English" },
    ]);
  });

  it("filters translations by language", async () => {
    expect((await listTranslations("de")).map((t) => t.short)).toEqual([
      "S00",
      "LUT",
      "ELB",
    ]);
    expect((await listTranslations("en")).map((t) => t.short)).toEqual(["BSB"]);
  });

  it("returns no translations for an unknown language", async () => {
    expect(await listTranslations("fr")).toEqual([]);
  });

  it("falls back to an empty list when the metadata cannot be loaded", async () => {
    useApi(createApi({ fail: (url) => url.includes("languages.json") }));
    expect(await listLanguages()).toEqual([]);
    expect(await listTranslations("de")).toEqual([]);
  });

  it("survives a network error", async () => {
    setRequestUrlHandler(async () => {
      throw new Error("network down");
    });
    expect(await listLanguages()).toEqual([]);
    expect(await listTranslations("de")).toEqual([]);
  });
});

describe("book resolution fallbacks", () => {
  it("resolves a canonical prefix match", async () => {
    const api = useApi();
    const result = await fetchBibleQuote("Malea 1:1", settings());
    expect(result.heading).toContain("Maleachi");
    expect(
      api.requests.some((url) => url.includes("/get-chapter/S00/Maleachi/"))
    ).toBe(true);
  });

  it("resolves a canonical substring match", async () => {
    useApi();
    const result = await fetchBibleQuote("osea 1:1", settings());
    expect(result.heading).toContain("Hosea");
  });

  it("resolves through the translation list when the language has no alias", async () => {
    useApi();
    const result = await fetchBibleQuote(
      "Malea 1:1",
      settings({ language: "xx" })
    );
    expect(result.heading).toContain("Maleachi");
  });

  it("skips a canonical match beyond the translation's book count", async () => {
    useApi(createApi({ books: { S00: GERMAN_BOOKS.slice(0, 30) } }));
    await expect(fetchBibleQuote("Malea 1:1", settings())).rejects.toThrow(
      /Unknown or ambiguous book/
    );
  });

  it("falls back to canonical names when a translation book entry is missing", async () => {
    const books = Array.from({ length: 66 }, (_, index) =>
      index === 42 ? {} : { name: "x" }
    );
    useApi(createApi({ booksJson: { S00: books } }));
    const result = await fetchBibleQuote("Johannes 3:16", settings());
    expect(result.heading).toBe("**Johannes 3,16** (Schlachter 2000)");
  });

  it("falls back to the book number when no name is available at all", async () => {
    const books = Array.from({ length: 66 }, (_, index) =>
      index === 42 ? {} : { name: "x" }
    );
    useApi(createApi({ booksJson: { S00: books } }));
    const result = await fetchBibleQuote(
      "43 3:16",
      settings({ language: "xx" })
    );
    expect(result.heading).toBe("**43 3,16** (Schlachter 2000)");
  });

  it("fails when the book list cannot be loaded", async () => {
    useApi(createApi({ fail: (url) => url.includes("/get-books/") }));
    await expect(fetchBibleQuote("Johannes 3:16", settings())).rejects.toThrow(
      /Could not load the book list/
    );
  });
});

describe("footnote and cleanup edge cases", () => {
  it("keeps an absolute footnote link as-is", async () => {
    useApi(
      createApi({
        chapters: {
          "S00/Johannes/1": [
            {
              verse: 1,
              text: "Text<f>[1]</f>",
              comment:
                "\u2009[1] siehe <a href='https://example.com/x'>Link</a>.",
            },
          ],
        },
      })
    );
    const result = await fetchBibleQuote("Johannes 1", settings());
    expect(result.footnotes[0]?.text).toContain("(https://example.com/x)");
  });

  it("drops footnote markers without a number or body", async () => {
    useApi(
      createApi({
        chapters: {
          "S00/Johannes/1": [
            {
              verse: 1,
              text: "A<f>plain</f>B<f>[9]</f>C<f>[1]</f>D",
              comment: "",
            },
          ],
        },
      })
    );
    const result = await fetchBibleQuote("Johannes 1", settings());
    expect(result.quote).toContain("ABCD");
    expect(result.footnotes).toEqual([]);
  });

  it("handles an empty verse text", async () => {
    useApi(
      createApi({ chapters: { "S00/Johannes/1": [{ verse: 1, text: "" }] } })
    );
    const result = await fetchBibleQuote("Johannes 1", settings());
    expect(result.quote).toContain("> **1** ");
  });

  it("reports a whole chapter with no verses", async () => {
    useApi(createApi({ chapters: { "S00/Johannes/3": [] } }));
    await expect(fetchBibleQuote("Johannes 3", settings())).rejects.toThrow(
      /No verses found for Johannes 3 \(S00\)\./
    );
  });
});

describe("output and search edge cases", () => {
  const chapterOnly = () =>
    useApi(
      createApi({
        chapters: {
          "S00/Johannes/3": [
            { verse: 1, text: "A" },
            { verse: 2, text: "B" },
          ],
        },
      })
    );

  it("uses the default template parts when they are blank", async () => {
    chapterOnly();
    const result = await fetchBibleQuote(
      "Johannes 3",
      settings({
        style: "custom",
        template: "",
        verseTemplate: "",
        verseSeparator: undefined as unknown as string,
      })
    );
    expect(result.quote).toBe(
      "> **Johannes 3** (Schlachter 2000)\n>\n> **1** A\n> **2** B"
    );
  });

  it("falls back to the bold preset for an unknown style", async () => {
    chapterOnly();
    const result = await fetchBibleQuote(
      "Johannes 3",
      settings({ style: "weird" as QuoteStyle })
    );
    expect(result.quote).toContain("> **Johannes 3** (Schlachter 2000)");
  });

  it("omits the footnote section when there are none", async () => {
    useApi();
    const output = await fetchBibleQuotes(
      "Johannes 3:16",
      settings({ footnotes: false })
    );
    expect(output).not.toContain("[^1]:");
    expect(output).toContain("> **Johannes 3,16**");
  });

  it("handles a search hit with an empty text", async () => {
    useApi(
      createApi({
        search: { "S00/x": [{ book: 1, chapter: 1, verse: 1, text: "" }] },
      })
    );
    const results = await searchBible("x", "S00");
    expect(results[0].segments).toEqual([{ text: "", highlight: false }]);
  });

  it("keeps the book number when the name is unknown", async () => {
    useApi(
      createApi({
        search: { "S00/x": [{ book: 99, chapter: 1, verse: 1, text: "hi" }] },
      })
    );
    const results = await searchBible("x", "S00");
    expect(results[0].reference).toBe("99 1,1");
  });
});

describe("language metadata edge cases", () => {
  const groups = [
    {
      language: "German",
      translations: [{ short_name: "S00", full_name: "Schlachter 2000" }],
    },
    { language: "English" },
    {
      language: "French",
      translations: [{ short_name: "F01", full_name: "French Bible" }],
    },
    {
      language: "",
      translations: [{ short_name: "X", full_name: "No language" }],
    },
  ];

  it("skips groups without a language and groups without translations", async () => {
    useApi(createApi({ languages: groups }));
    expect(await listLanguages()).toEqual([
      { key: "de", label: "German" },
      { key: "en", label: "English" },
      { key: "French", label: "French" },
    ]);
    expect(await listTranslations("en")).toEqual([]);
  });

  it("uses the raw language name when there is no alias", async () => {
    useApi(createApi({ languages: groups }));
    expect((await listTranslations("French")).map((t) => t.short)).toEqual([
      "F01",
    ]);
  });

  it("falls back to the translation code when the name is unknown", async () => {
    useApi(createApi({ languages: groups }));
    const result = await fetchBibleQuote(
      "Johannes 3:16",
      settings({ translation: "ZZ" })
    );
    expect(result.heading).toContain("(ZZ)");
  });
});

describe("fixture sanity", () => {
  it("keeps the default chapter stable", () => {
    expect(DEFAULT_CHAPTER).toHaveLength(5);
  });
});
