import {
  App,
  Editor,
  Modal,
  normalizePath,
  Notice,
  Plugin,
  PluginSettingTab,
  SettingDefinitionItem,
} from "obsidian";
import {
  BibleSettings,
  DEFAULT_NOTE_FORMAT,
  DEFAULT_SETTINGS,
  fetchBibleQuotes,
  listLanguages,
  listTranslations,
  needsNoteTitle,
  NOTE_COLORS,
  parseTranslations,
  parseVerseContexts,
  QuoteStyle,
  renderNotePath,
  SearchResult,
  searchBible,
  setBibleCache,
  VerseContext,
} from "./bible";
import { CacheStorage, JsonCache } from "./cache";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function sanitizeFileName(title: string): string {
  const cleaned = title.replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
  return cleaned || "Note";
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

class NoteTitleModal extends Modal {
  private initial: string;
  private needsTitle: boolean;
  private colors: string[];
  private defaultColor: string;
  private onSubmit: (title: string, color: string) => void;

  constructor(
    app: App,
    initial: string,
    needsTitle: boolean,
    colors: string[],
    defaultColor: string,
    onSubmit: (title: string, color: string) => void
  ) {
    super(app);
    this.initial = initial;
    this.needsTitle = needsTitle;
    this.colors = colors;
    this.defaultColor = defaultColor;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.addClass("simple-bible-fetcher-modal");
    contentEl.createEl("h3", { text: "Annotation note" });

    let input: HTMLInputElement | null = null;
    if (this.needsTitle) {
      input = contentEl.createEl("input", {
        type: "text",
        placeholder: "Note title",
      });
      input.addClass("simple-bible-fetcher-input");
      input.value = this.initial;
      input.focus();
      input.select();
    }

    contentEl.createEl("label", { text: "Color" });
    const select = contentEl.createEl("select");
    select.addClass("simple-bible-fetcher-input");
    for (const color of this.colors) {
      select.createEl("option", { text: color, value: color });
    }
    select.value = this.defaultColor;

    const submit = (): void => {
      const title = input ? input.value.trim() : "";
      if (this.needsTitle && !title) return;
      this.close();
      this.onSubmit(title, select.value);
    };

    if (input) {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submit();
        }
      });
    }

    const button = contentEl.createEl("button", { text: "Create" });
    button.addEventListener("click", submit);
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

    this.registerDomEvent(
      activeDocument,
      "click",
      (event) => this.openNoteOnClick(event),
      true
    );

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

    this.addCommand({
      id: "annotate-verse",
      name: "Annotate verse (create note)",
      editorCallback: (editor: Editor) => this.annotateVerse(editor),
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

  private annotateVerse(editor: Editor): void {
    const from = editor.getCursor("from");
    const to = editor.getCursor("to");
    const lines = Array.from({ length: editor.lineCount() }, (_, index) =>
      editor.getLine(index)
    );
    const contexts = parseVerseContexts(lines, from.line, to.line);
    if (contexts.length === 0) {
      new Notice(
        "Simple Bible Fetcher: place the cursor on a verse inserted by the plugin, or select one or more verses.",
        6000
      );
      return;
    }
    const template = this.noteTemplate();
    const colors = NOTE_COLORS;
    const defaultColor = colors.includes(this.settings.noteDefaultColor)
      ? this.settings.noteDefaultColor
      : colors[0];
    const queue = [...contexts];
    let offset = 0;
    const createNext = (): void => {
      const context = queue.shift();
      if (!context) return;
      new NoteTitleModal(
        this.app,
        context.translation
          ? `${context.reference} (${context.translation})`
          : context.reference,
        needsNoteTitle(template),
        colors,
        defaultColor,
        (title, color) => {
          void this.createNote(
            editor,
            context.endLine + offset,
            context,
            template,
            title,
            color
          ).then((created) => {
            if (!created) return;
            offset += 4;
            createNext();
          });
        }
      ).open();
    };
    createNext();
  }

  private noteTemplate(): string {
    const folder = normalizePath(this.settings.noteFolder.trim());
    const format = this.settings.noteFormat.trim() || DEFAULT_NOTE_FORMAT;
    return folder ? `${folder}/${format}` : format;
  }

  private async createNote(
    editor: Editor,
    line: number,
    context: VerseContext,
    template: string,
    title: string,
    color: string
  ): Promise<boolean> {
    try {
      let path = normalizePath(
        renderNotePath(template, context, sanitizeFileName(title))
      );
      if (!path.endsWith(".md")) path += ".md";
      await this.ensureFolders(path);
      if (!this.app.vault.getAbstractFileByPath(path)) {
        await this.app.vault.create(path, "");
      }
      const link = path.replace(/\.md$/, "");
      const target = editor.getLine(line);
      editor.replaceRange(`\n\n> [!zettel-${color}]\n> ![[${link}]]\n`, {
        line,
        ch: target.length,
      });
      await this.openNote(path);
      return true;
    } catch (error) {
      new Notice(`Simple Bible Fetcher: ${errorMessage(error)}`, 6000);
      return false;
    }
  }

  private async openNote(path: string): Promise<void> {
    if (this.settings.noteOpen === "none") return;
    const file = this.app.vault.getFileByPath(path);
    if (!file) return;
    const leaf =
      this.settings.noteOpen === "tab"
        ? this.app.workspace.getLeaf("tab")
        : this.app.workspace.getLeaf("split", "vertical");
    await leaf.openFile(file);
  }

  private openNoteOnClick(event: MouseEvent): void {
    const action = this.settings.noteClick;
    if (action === "current") return;
    const target = event.target as Element;
    const embed = target.closest(
      '.callout[data-callout^="zettel-"] .internal-embed'
    );
    const src = embed?.getAttribute("src");
    if (!src) return;
    event.preventDefault();
    event.stopPropagation();
    if (action === "none") return;
    const file = this.app.workspace.getActiveFile();
    void this.app.workspace.openLinkText(
      src,
      file ? file.path : "",
      action === "tab" ? "tab" : "split"
    );
  }

  private async ensureFolders(path: string): Promise<void> {
    const folder = path.split("/").slice(0, -1).join("/");
    if (!folder) return;
    let current = "";
    for (const part of folder.split("/")) {
      current = current ? `${current}/${part}` : part;
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
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
      {
        name: "Note folder",
        desc: "Folder for annotation notes. Blank means the vault root.",
        control: {
          type: "folder",
          key: "noteFolder",
          placeholder: "Bible Notes",
          includeRoot: true,
        },
      },
      {
        name: "Note format",
        desc: "File name (and optional subfolders) for annotation notes. Placeholders: {title}, {reference}, {translation}, {book}, {chapter}, {verse}, {verses}. A title is only asked for when it contains {title}.",
        control: { type: "text", key: "noteFormat", placeholder: "{title}" },
      },
      {
        name: "Note opens",
        desc: "Where a new annotation note opens: a split to the right, a new tab, or not at all.",
        control: {
          type: "dropdown",
          key: "noteOpen",
          options: {
            split: "Split right",
            tab: "New tab",
            none: "Do not open",
          },
        },
      },
      {
        name: "Note opens on click",
        desc: "Where an embedded annotation note opens when you click it. Current pane leaves Obsidian's default click behaviour untouched.",
        control: {
          type: "dropdown",
          key: "noteClick",
          options: {
            current: "Current pane",
            split: "Split right",
            tab: "New tab",
            none: "Do not open",
          },
        },
      },
      {
        name: "Default note color",
        desc: "Color preselected when creating an annotation note. The palette lives in styles.css.",
        control: {
          type: "dropdown",
          key: "noteDefaultColor",
          options: NOTE_COLORS.reduce<Record<string, string>>((options, name) => {
            options[name] = name;
            return options;
          }, {}),
        },
      },
    ];
  }
}
