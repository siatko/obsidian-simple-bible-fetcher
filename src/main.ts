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
} from "./bible";

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

export default class SimpleBibleFetcherPlugin extends Plugin {
  settings: BibleSettings;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addCommand({
      id: "insert-bible-quote",
      name: "Insert Bible quote",
      editorCallback: (editor: Editor) => this.promptAndInsert(editor),
    });

    this.addSettingTab(new SimpleBibleFetcherSettingTab(this.app, this));
  }

  private promptAndInsert(editor: Editor): void {
    new ReferenceModal(this.app, (reference) => {
      void this.insert(editor, reference);
    }).open();
  }

  private async insert(editor: Editor, reference: string): Promise<void> {
    try {
      const quote = await fetchBibleQuotes(reference, this.settings);
      editor.replaceSelection(quote);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Simple Bible Fetcher: ${message}`, 6000);
    }
  }

  async loadSettings(): Promise<void> {
    const stored = ((await this.loadData()) ?? {}) as Partial<BibleSettings>;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, stored);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
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
        control: {
          type: "dropdown",
          key: "style",
          defaultValue: "bold",
          options: {
            bold: "Blockquote, bold verse number",
            "quote-each": "One blockquote per verse",
            prose: "Blockquote, running text",
          },
        },
      },
      {
        name: "Source link",
        desc: "Make the heading itself a bolls.life link.",
        control: { type: "toggle", key: "includeSourceLink" },
      },
    ];
  }
}
