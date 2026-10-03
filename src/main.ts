import {
  App,
  Editor,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import {
  BibleSettings,
  DEFAULT_SETTINGS,
  QuoteStyle,
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

  display(): void {
    void this.renderSettings();
  }

  private async renderSettings(): Promise<void> {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("Simple Bible Fetcher").setHeading();

    const languages = await listLanguages();
    const languageOptions =
      languages.length > 0
        ? languages
        : [
            { key: "de", label: "German" },
            { key: "en", label: "English" },
          ];

    new Setting(containerEl)
      .setName("Language")
      .setDesc(
        "Filters the translations below and recognizes book names. German and English also accept common abbreviations."
      )
      .addDropdown((dropdown) => {
        for (const option of languageOptions) {
          dropdown.addOption(option.key, option.label);
        }
        if (
          !languageOptions.some(
            (option) => option.key === this.plugin.settings.language
          )
        ) {
          dropdown.addOption(
            this.plugin.settings.language,
            this.plugin.settings.language
          );
        }
        dropdown
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value;
            const options = await listTranslations(value);
            if (
              !options.some((t) => t.short === this.plugin.settings.translation)
            ) {
              const fallback =
                options.find((t) => t.short === DEFAULT_TRANSLATION[value])
                  ?.short ?? options[0]?.short;
              if (fallback) this.plugin.settings.translation = fallback;
            }
            await this.plugin.saveSettings();
            void this.renderSettings();
          });
      });

    const translations = await listTranslations(this.plugin.settings.language);
    const translationSetting = new Setting(containerEl).setName("Translation");

    if (translations.length > 0) {
      translationSetting.setDesc("bolls.life translation.");
      translationSetting.addDropdown((dropdown) => {
        for (const translation of translations) {
          dropdown.addOption(
            translation.short,
            `${translation.short} – ${translation.full}`
          );
        }
        dropdown
          .setValue(this.plugin.settings.translation)
          .onChange(async (value) => {
            this.plugin.settings.translation = value;
            await this.plugin.saveSettings();
          });
      });
    } else {
      translationSetting
        .setDesc(
          "Could not load the translation list (offline?). Enter a code, e.g. S00, LUT."
        )
        .addText((text) =>
          text
            .setPlaceholder(this.plugin.settings.translation)
            .setValue(this.plugin.settings.translation)
            .onChange(async (value) => {
              this.plugin.settings.translation = value.trim();
              await this.plugin.saveSettings();
            })
        );
    }

    new Setting(containerEl)
      .setName("Format")
      .setDesc("How the verses are inserted.")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("bold", "Blockquote, bold verse number")
          .addOption("quote-each", "One blockquote per verse")
          .addOption("prose", "Blockquote, running text")
          .setValue(this.plugin.settings.style)
          .onChange(async (value) => {
            this.plugin.settings.style = value as QuoteStyle;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Source link")
      .setDesc("Make the heading itself a bolls.life link.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeSourceLink)
          .onChange(async (value) => {
            this.plugin.settings.includeSourceLink = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
