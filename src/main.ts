import {
  App,
  Editor,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  SettingDefinitionItem,
} from "obsidian";
import {
  BibleSettings,
  DEFAULT_SETTINGS,
  fetchBibleQuotes,
  listLanguages,
  listTranslations,
  parseTranslations,
  QuoteStyle,
  SearchResult,
  searchBible,
  setBibleCache,
} from "./bible";
import { CacheStorage, JsonCache } from "./cache";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

class PluginDataStorage implements CacheStorage {
  constructor(private plugin: SimpleBibleFetcherPlugin) {}

  async read(): Promise<string | null> {
    const data = await this.plugin.readData();
    return data.cache == null ? null : JSON.stringify(data.cache);
  }

  async write(payload: string): Promise<void> {
    const parsed = JSON.parse(payload) as unknown;
    await this.plugin.mutateData((data) => {
      data.cache = parsed;
    });
  }
}

const DEFAULT_TRANSLATION: Record<string, string> = {
  de: "S00",
  en: "BSB",
};

class ReferenceModal extends Modal {
  private onSubmit: (reference: string) => void;

  constructor(app: App, onSubmit: (reference: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Bible reference" });

    const input = contentEl.createEl("input", {
      type: "text",
      placeholder: "e.g. John 3:16 (separate multiple with ;)",
    });
    input.addClass("simple-bible-fetcher-input");
    input.focus();

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        const value = input.value.trim();
        this.close();
        if (value) this.onSubmit(value);
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

class SearchModal extends Modal {
  private search: (query: string) => Promise<SearchResult[]>;
  private onSelect: (result: SearchResult) => void;

  constructor(
    app: App,
    search: (query: string) => Promise<SearchResult[]>,
    onSelect: (result: SearchResult) => void
  ) {
    super(app);
    this.search = search;
    this.onSelect = onSelect;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h3", { text: "Search the Bible" });

    const input = contentEl.createEl("input", {
      type: "text",
      placeholder: "Word or phrase…",
    });
    input.addClass("simple-bible-fetcher-input");
    input.focus();

    const status = contentEl.createDiv({
      cls: "simple-bible-fetcher-status",
    });
    const results = contentEl.createDiv({
      cls: "simple-bible-fetcher-results",
    });

    const run = async (): Promise<void> => {
      const query = input.value.trim();
      if (!query) return;
      status.setText("Searching…");
      results.empty();
      try {
        const hits = await this.search(query);
        status.setText(
          hits.length > 0 ? `${hits.length} result(s)` : "No results."
        );
        for (const hit of hits) {
          const item = results.createEl("button", {
            cls: "simple-bible-fetcher-result",
          });
          item.createDiv({
            cls: "simple-bible-fetcher-result-ref",
            text: hit.reference,
          });
          const textEl = item.createDiv({
            cls: "simple-bible-fetcher-result-text",
          });
          for (const segment of hit.segments) {
            if (segment.highlight) {
              textEl.createEl("mark", { text: segment.text });
            } else {
              textEl.createSpan({ text: segment.text });
            }
          }
          item.addEventListener("click", () => {
            this.close();
            this.onSelect(hit);
          });
        }
      } catch (error) {
        status.setText(errorMessage(error));
      }
    };

    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void run();
      }
    });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export default class SimpleBibleFetcherPlugin extends Plugin {
  settings: BibleSettings;
  private cache: JsonCache | null = null;
  private dataQueue: Promise<void> = Promise.resolve();

  async onload(): Promise<void> {
    const cache = new JsonCache(new PluginDataStorage(this));
    await cache.load();
    setBibleCache(cache);
    this.cache = cache;

    await this.loadSettings();

    this.addCommand({
      id: "insert-bible-quote",
      name: "Insert Bible quote",
      editorCallback: (editor: Editor) => this.promptAndInsert(editor),
    });

    this.addCommand({
      id: "insert-bible-quote-parallel",
      name: "Insert Bible quote (parallel translations + main)",
      editorCallback: (editor: Editor) => this.promptAndInsertParallel(editor),
    });

    this.addCommand({
      id: "search-bible",
      name: "Search Bible (keyword)",
      editorCallback: (editor: Editor) => this.searchAndInsert(editor),
    });

    this.addSettingTab(new SimpleBibleFetcherSettingTab(this.app, this));
  }

  onunload(): void {
    void this.cache?.flush();
  }

  private promptAndInsert(editor: Editor): void {
    new ReferenceModal(this.app, (reference) => {
      void this.insert(editor, reference);
    }).open();
  }

  private promptAndInsertParallel(editor: Editor): void {
    const translations = this.parallelTranslations();
    if (translations.length === 0) {
      new Notice(
        "Simple Bible Fetcher: set at least one parallel translation in the settings.",
        6000
      );
      return;
    }
    new ReferenceModal(this.app, (reference) => {
      void this.insert(editor, reference, translations);
    }).open();
  }

  private searchAndInsert(editor: Editor): void {
    new SearchModal(
      this.app,
      (query) => searchBible(query, this.settings.translation),
      (result) => {
        void this.insert(
          editor,
          `${result.book} ${result.chapter}:${result.verse}`
        );
      }
    ).open();
  }

  private parallelTranslations(): string[] {
    return parseTranslations(this.settings.parallelTranslations);
  }

  private async insert(
    editor: Editor,
    reference: string,
    translations?: string[]
  ): Promise<void> {
    try {
      const quote = await fetchBibleQuotes(reference, this.settings, translations);
      editor.replaceSelection(quote);
    } catch (error) {
      new Notice(`Simple Bible Fetcher: ${errorMessage(error)}`, 6000);
    }
  }

  async readData(): Promise<Record<string, unknown>> {
    const data: unknown = (await this.loadData()) ?? {};
    return typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  }

  async mutateData(
    mutate: (data: Record<string, unknown>) => void
  ): Promise<void> {
    const run = this.dataQueue.then(async () => {
      const data = await this.readData();
      mutate(data);
      await this.saveData(data);
    });
    this.dataQueue = run.catch(() => undefined);
    return run;
  }

  async loadSettings(): Promise<void> {
    const data = await this.readData();
    delete data.cache;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.mutateData((data) => {
      Object.assign(data, this.settings);
    });
  }
}

class SimpleBibleFetcherSettingTab extends PluginSettingTab {
  plugin: SimpleBibleFetcherPlugin;

  constructor(app: App, plugin: SimpleBibleFetcherPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        name: "Language",
        desc: "Filters the translations below and recognizes book names. German and English also accept common abbreviations.",
        render: (setting) => {
          setting.addDropdown(async (dropdown) => {
            const languages = await listLanguages();
            const options =
              languages.length > 0
                ? languages
                : [
                    { key: "de", label: "German" },
                    { key: "en", label: "English" },
                  ];
            for (const option of options) {
              dropdown.addOption(option.key, option.label);
            }
            if (!options.some((o) => o.key === this.plugin.settings.language)) {
              dropdown.addOption(
                this.plugin.settings.language,
                this.plugin.settings.language
              );
            }
            dropdown
              .setValue(this.plugin.settings.language)
              .onChange(async (value) => {
                this.plugin.settings.language = value;
                const translations = await listTranslations(value);
                if (
                  !translations.some(
                    (t) => t.short === this.plugin.settings.translation
                  )
                ) {
                  const fallback =
                    translations.find(
                      (t) => t.short === DEFAULT_TRANSLATION[value]
                    )?.short ?? translations[0]?.short;
                  if (fallback) this.plugin.settings.translation = fallback;
                }
                await this.plugin.saveSettings();
                this.update();
              });
          });
        },
      },
      {
        name: "Translation",
        desc: "bolls.life translation.",
        render: (setting) => {
          setting.addDropdown(async (dropdown) => {
            const translations = await listTranslations(
              this.plugin.settings.language
            );
            if (translations.length === 0) {
              dropdown.addOption(
                this.plugin.settings.translation,
                this.plugin.settings.translation
              );
            } else {
              for (const translation of translations) {
                dropdown.addOption(
                  translation.short,
                  `${translation.short} - ${translation.full}`
                );
              }
            }
            dropdown
              .setValue(this.plugin.settings.translation)
              .onChange(async (value) => {
                this.plugin.settings.translation = value;
                await this.plugin.saveSettings();
              });
          });
        },
      },
      {
        name: "Format",
        desc: "How the verses are inserted.",
        render: (setting) => {
          setting.addDropdown((dropdown) => {
            dropdown
              .addOption("bold", "Blockquote, bold verse number")
              .addOption("quote-each", "One blockquote per verse")
              .addOption("prose", "Blockquote, running text")
              .addOption("custom", "Custom template")
              .setValue(this.plugin.settings.style)
              .onChange(async (value) => {
                this.plugin.settings.style = value as QuoteStyle;
                await this.plugin.saveSettings();
                this.update();
              });
          });
        },
      },
      {
        name: "Passage template",
        desc: "Used for the custom format. Placeholders: {heading}, {reference}, {book}, {chapter}, {translation}, {translationName}, {sourceUrl}, {verses}.",
        visible: () => this.plugin.settings.style === "custom",
        control: { type: "textarea", key: "template", rows: 3 },
      },
      {
        name: "Verse template",
        desc: "Applied to each verse in the custom format. Placeholders: {number}, {text}, plus the passage placeholders.",
        visible: () => this.plugin.settings.style === "custom",
        control: { type: "textarea", key: "verseTemplate", rows: 2 },
      },
      {
        name: "Verse separator",
        desc: "Inserted between verses in the custom format. Use \\n for a line break.",
        visible: () => this.plugin.settings.style === "custom",
        control: {
          type: "text",
          key: "verseSeparator",
          placeholder: "\\n",
        },
      },
      {
        name: "Footnotes",
        desc: "Render the source's footnotes as Markdown footnotes (with the text appended below each section), or strip the markers.",
        control: { type: "toggle", key: "footnotes" },
      },
      {
        name: "Source link",
        desc: "Make the heading itself a bolls.life link.",
        control: { type: "toggle", key: "includeSourceLink" },
      },
      {
        name: "Parallel translations",
        desc: "Additional translations to insert after the main one, comma-separated (e.g. LUT, ELB). The main translation is always included first.",
        control: {
          type: "text",
          key: "parallelTranslations",
          placeholder: "LUT, ELB",
        },
      },
    ];
  }
}
