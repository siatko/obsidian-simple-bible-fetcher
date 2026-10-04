import { beforeEach, describe, expect, it, vi } from "vitest";
import SimpleBibleFetcherPlugin, { errorMessage } from "../src/main";
import { parseTranslations } from "../src/bible";
import { DEFAULT_LANGUAGES } from "./fixtures";
import {
  App,
  Modal,
  Notice,
  Setting,
  setRequestUrlHandler,
} from "./obsidian-stub";
import { createApi } from "./fixtures";

function useApi(api = createApi()): ReturnType<typeof createApi> {
  setRequestUrlHandler(api.handler);
  return api;
}

type Command = {
  id: string;
  name: string;
  editorCallback?: (editor: unknown) => unknown;
};

type TestSettingTab = {
  getSettingDefinitions(): unknown[];
  updates: number;
};

type TestPlugin = SimpleBibleFetcherPlugin & {
  setData(data: unknown): void;
  commands: Command[];
  settingTabs: TestSettingTab[];
};

async function loadPlugin(
  data?: Record<string, unknown>
): Promise<TestPlugin> {
  const plugin = new SimpleBibleFetcherPlugin(new App() as never, {
    id: "simple-bible-fetcher",
  } as never);
  if (data) (plugin as unknown as TestPlugin).setData(data);
  await plugin.onload();
  return plugin as unknown as TestPlugin;
}

function command(plugin: TestPlugin, id: string): Command {
  const found = plugin.commands.find((c) => c.id === id);
  if (!found) throw new Error(`command not found: ${id}`);
  return found;
}

function pressEnter(input: HTMLInputElement): void {
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
}

describe("errorMessage", () => {
  it("formats Error and non-Error values", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
    expect(errorMessage("plain")).toBe("plain");
    expect(errorMessage(42)).toBe("42");
  });
});

describe("parseTranslations", () => {
  it("splits on commas, semicolons and whitespace", () => {
    expect(parseTranslations("LUT, ELB;S00  BSB")).toEqual([
      "LUT",
      "ELB",
      "S00",
      "BSB",
    ]);
  });

  it("returns an empty list for blank input", () => {
    expect(parseTranslations("   ")).toEqual([]);
  });
});

describe("settings persistence", () => {
  it("merges stored settings over the defaults and ignores the cache key", async () => {
    const plugin = await loadPlugin({
      translation: "LUT",
      cache: { schemaVersion: 1, entries: {} },
    });

    expect(plugin.settings.translation).toBe("LUT");
    expect(plugin.settings.style).toBe("bold");
    expect(
      (plugin.settings as unknown as Record<string, unknown>).cache
    ).toBeUndefined();
  });

  it("preserves the cache when saving settings", async () => {
    const plugin = await loadPlugin({
      parallelTranslations: "LUT",
      cache: { schemaVersion: 1, entries: { url: ["a"] } },
    });

    plugin.settings.translation = "ELB";
    await plugin.saveSettings();

    const stored = (await plugin.loadData()) as Record<string, unknown>;
    expect(stored.translation).toBe("ELB");
    expect(stored.cache).toEqual({ schemaVersion: 1, entries: { url: ["a"] } });
  });

  it("falls back to defaults when the stored data is not an object", async () => {
    const plugin = new SimpleBibleFetcherPlugin(new App() as never, {
      id: "simple-bible-fetcher",
    } as never) as unknown as TestPlugin;
    plugin.setData("not-an-object");
    await plugin.onload();

    expect(plugin.settings.translation).toBe("S00");
    expect(plugin.settings.style).toBe("bold");
  });

  it("preserves settings when the cache is written", async () => {
    const plugin = await loadPlugin({
      translation: "LUT",
      cache: { schemaVersion: 1, entries: { url: ["a"] } },
    });

    const cache = (plugin as unknown as { cache: { set: Function; flush: Function } })
      .cache;
    cache.set("other", [1]);
    await cache.flush();

    const stored = (await plugin.loadData()) as Record<string, unknown>;
    expect(stored.translation).toBe("LUT");
    expect((stored.cache as { entries: Record<string, unknown> }).entries).toEqual({
      url: ["a"],
      other: [1],
    });
  });
});

describe("plugin surface", () => {
  let plugin: TestPlugin;

  beforeEach(async () => {
    useApi();
    plugin = await loadPlugin();
  });

  it("registers its three commands and one settings tab", () => {
    expect(plugin.commands.map((c) => c.id).sort()).toEqual([
      "insert-bible-quote",
      "insert-bible-quote-parallel",
      "search-bible",
    ]);
    expect(plugin.settingTabs).toHaveLength(1);
  });

  it("declares the custom-template and translation settings", () => {
    const defs = plugin.settingTabs[0].getSettingDefinitions() as Array<{
      name?: string;
      control?: { key?: string };
      visible?: () => boolean;
    }>;
    const byName = (name: string) => defs.find((d) => d.name === name);

    expect(byName("Passage template")?.control?.key).toBe("template");
    expect(byName("Verse template")?.control?.key).toBe("verseTemplate");
    expect(byName("Verse separator")?.control?.key).toBe("verseSeparator");
    expect(byName("Footnotes")?.control?.key).toBe("footnotes");
    expect(byName("Source link")?.control?.key).toBe("includeSourceLink");
    expect(byName("Parallel translations")?.control?.key).toBe(
      "parallelTranslations"
    );
  });

  it("shows the template settings only for the custom format", () => {
    const defs = plugin.settingTabs[0].getSettingDefinitions() as Array<{
      name?: string;
      visible?: () => boolean;
    }>;

    for (const name of [
      "Passage template",
      "Verse template",
      "Verse separator",
    ]) {
      const definition = defs.find((d) => d.name === name);
      plugin.settings.style = "custom";
      expect(definition?.visible?.()).toBe(true);
      plugin.settings.style = "bold";
      expect(definition?.visible?.()).toBe(false);
    }
  });
});

type Definition = {
  name?: string;
  control?: { key?: string };
  visible?: () => boolean;
  render?: (setting: Setting) => void;
};

function findDefinition(plugin: TestPlugin, name: string): Definition {
  const defs = plugin.settingTabs[0].getSettingDefinitions() as Definition[];
  const found = defs.find((d) => d.name === name);
  if (!found) throw new Error(`setting not found: ${name}`);
  return found;
}

describe("settings tab rendering", () => {
  async function renderDefinition(
    plugin: TestPlugin,
    name: string
  ): Promise<{ setting: Setting; tab: TestSettingTab }> {
    const tab = plugin.settingTabs[0];
    const setting = new Setting(document.createElement("div"));
    findDefinition(plugin, name).render?.(setting);
    return { setting, tab };
  }

  it("lists languages and switches the translation on change", async () => {
    useApi();
    const plugin = await loadPlugin();
    const { setting, tab } = await renderDefinition(plugin, "Language");

    await vi.waitFor(() =>
      expect(setting.components[0].options.map((o) => o.value)).toEqual([
        "de",
        "en",
      ])
    );

    await setting.components[0].trigger("en");
    expect(plugin.settings.language).toBe("en");
    expect(plugin.settings.translation).toBe("BSB");
    expect(tab.updates).toBeGreaterThan(0);
  });

  it("falls back to the first translation when no default exists", async () => {
    useApi(
      createApi({
        languages: [
          ...DEFAULT_LANGUAGES,
          {
            language: "French",
            translations: [{ short_name: "F01", full_name: "French Bible" }],
          },
        ],
      })
    );
    const plugin = await loadPlugin();
    const { setting } = await renderDefinition(plugin, "Language");

    await vi.waitFor(() =>
      expect(setting.components[0].options.map((o) => o.value)).toContain(
        "French"
      )
    );
    await setting.components[0].trigger("French");
    expect(plugin.settings.language).toBe("French");
    expect(plugin.settings.translation).toBe("F01");
  });

  it("keeps an unknown current language as its own option", async () => {
    useApi();
    const plugin = await loadPlugin({ language: "fr" });
    const { setting } = await renderDefinition(plugin, "Language");

    await vi.waitFor(() =>
      expect(setting.components[0].options.map((o) => o.value)).toContain("fr")
    );
  });

  it("falls back to German and English when the language list is unavailable", async () => {
    useApi(createApi({ fail: (url) => url.includes("languages.json") }));
    const plugin = await loadPlugin();
    const { setting } = await renderDefinition(plugin, "Language");

    await vi.waitFor(() =>
      expect(setting.components[0].options.map((o) => o.value)).toEqual([
        "de",
        "en",
      ])
    );
  });

  it("lists translations and persists the chosen one", async () => {
    useApi();
    const plugin = await loadPlugin();
    const { setting } = await renderDefinition(plugin, "Translation");

    await vi.waitFor(() =>
      expect(setting.components[0].options).toHaveLength(3)
    );

    await setting.components[0].trigger("LUT");
    expect(plugin.settings.translation).toBe("LUT");
    const stored = (await plugin.loadData()) as Record<string, unknown>;
    expect(stored.translation).toBe("LUT");
  });

  it("falls back to the current translation when the list is empty", async () => {
    useApi(createApi({ fail: (url) => url.includes("languages.json") }));
    const plugin = await loadPlugin();
    const { setting } = await renderDefinition(plugin, "Translation");

    await vi.waitFor(() =>
      expect(setting.components[0].options.map((o) => o.value)).toEqual(["S00"])
    );
  });

  it("switches to the custom format and refreshes the tab", async () => {
    useApi();
    const plugin = await loadPlugin();
    const { setting, tab } = await renderDefinition(plugin, "Format");

    await setting.components[0].trigger("custom");
    expect(plugin.settings.style).toBe("custom");
    expect(tab.updates).toBeGreaterThan(0);
  });
});

describe("lifecycle", () => {
  it("flushes the cache on unload", async () => {
    const plugin = await loadPlugin({ cache: { schemaVersion: 1, entries: {} } });
    const cache = (plugin as unknown as { cache: { flush: () => unknown } })
      .cache;
    const flush = vi.spyOn(cache, "flush");

    plugin.onunload();
    expect(flush).toHaveBeenCalled();
  });

  it("shows a notice when fetching fails", async () => {
    useApi(createApi({ fail: (url) => url.includes("/get-chapter/") }));
    const plugin = await loadPlugin();
    const editor = { replaceSelection: vi.fn() };

    command(plugin, "insert-bible-quote").editorCallback?.(editor);
    const input = Modal.instances.at(-1)?.contentEl.querySelector(
      "input"
    ) as HTMLInputElement;
    input.value = "Johannes 3:16";
    pressEnter(input);

    await vi.waitFor(() =>
      expect(Notice.instances.at(-1)?.message).toMatch(/^Simple Bible Fetcher:/)
    );
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });
});

describe("insert command", () => {
  it("inserts the fetched passage at the cursor", async () => {
    useApi();
    const plugin = await loadPlugin();
    const editor = { replaceSelection: vi.fn() };

    command(plugin, "insert-bible-quote").editorCallback?.(editor);
    const modal = Modal.instances.at(-1);
    expect(modal).toBeDefined();

    const input = modal?.contentEl.querySelector("input") as HTMLInputElement;
    input.value = "Johannes 3:16";
    pressEnter(input);

    await vi.waitFor(() => expect(editor.replaceSelection).toHaveBeenCalled());
    expect(editor.replaceSelection.mock.calls[0][0]).toContain(
      "Schlachter 2000"
    );
    expect(editor.replaceSelection.mock.calls[0][0]).toContain("[^1]");
  });

  it("does nothing when the reference is empty", async () => {
    useApi();
    const plugin = await loadPlugin();
    const editor = { replaceSelection: vi.fn() };

    command(plugin, "insert-bible-quote").editorCallback?.(editor);
    const input = Modal.instances.at(-1)?.contentEl.querySelector(
      "input"
    ) as HTMLInputElement;
    pressEnter(input);

    await Promise.resolve();
    expect(editor.replaceSelection).not.toHaveBeenCalled();
  });
});

describe("parallel command", () => {
  it("warns when no additional translation is configured", async () => {
    useApi();
    const plugin = await loadPlugin();
    const editor = { replaceSelection: vi.fn() };

    command(plugin, "insert-bible-quote-parallel").editorCallback?.(editor);

    expect(Notice.instances.at(-1)?.message).toMatch(/at least one/);
    expect(Modal.instances).toHaveLength(0);
  });

  it("inserts the main translation plus the listed ones", async () => {
    useApi();
    const plugin = await loadPlugin({ parallelTranslations: "LUT" });
    const editor = { replaceSelection: vi.fn() };

    command(plugin, "insert-bible-quote-parallel").editorCallback?.(editor);
    const input = Modal.instances.at(-1)?.contentEl.querySelector(
      "input"
    ) as HTMLInputElement;
    input.value = "Johannes 3:16";
    pressEnter(input);

    await vi.waitFor(() => expect(editor.replaceSelection).toHaveBeenCalled());
    const output = editor.replaceSelection.mock.calls[0][0] as string;
    expect(output).toContain("Schlachter 2000");
    expect(output).toContain("Luther (1912)");
  });
});

describe("search command", () => {
  it("lists highlighted matches and inserts the picked passage", async () => {
    useApi();
    const plugin = await loadPlugin();
    const editor = { replaceSelection: vi.fn() };

    command(plugin, "search-bible").editorCallback?.(editor);
    const modal = Modal.instances.at(-1);
    const input = modal?.contentEl.querySelector("input") as HTMLInputElement;
    input.value = "Liebe";
    pressEnter(input);

    await vi.waitFor(() =>
      expect(
        modal?.contentEl.querySelectorAll(".simple-bible-fetcher-result").length
      ).toBeGreaterThan(0)
    );

    const first = modal?.contentEl.querySelector(
      ".simple-bible-fetcher-result"
    ) as HTMLElement;
    expect(
      first.querySelector(".simple-bible-fetcher-result-ref")?.textContent
    ).toBe("Johannes 3,16");
    expect(first.querySelectorAll("mark")).toHaveLength(1);
    expect(first.querySelector("mark")?.textContent).toBe("Liebe");

    first.click();

    await vi.waitFor(() => expect(editor.replaceSelection).toHaveBeenCalled());
    expect(editor.replaceSelection.mock.calls[0][0]).toContain("Johannes 3,16");
  });

  it("does nothing for an empty query", async () => {
    useApi();
    const plugin = await loadPlugin();

    command(plugin, "search-bible").editorCallback?.({ replaceSelection: vi.fn() });
    const modal = Modal.instances.at(-1);
    const input = modal?.contentEl.querySelector("input") as HTMLInputElement;
    pressEnter(input);

    await Promise.resolve();
    expect(
      modal?.contentEl.querySelectorAll(".simple-bible-fetcher-result")
    ).toHaveLength(0);
    expect(
      modal?.contentEl.querySelector(".simple-bible-fetcher-status")?.textContent
    ).toBe("");
  });

  it("reports when the search returns no results", async () => {
    useApi(createApi({ search: { "S00/Nothing": [] } }));
    const plugin = await loadPlugin();

    command(plugin, "search-bible").editorCallback?.({ replaceSelection: vi.fn() });
    const modal = Modal.instances.at(-1);
    const input = modal?.contentEl.querySelector("input") as HTMLInputElement;
    input.value = "Nothing";
    pressEnter(input);

    await vi.waitFor(() =>
      expect(
        modal?.contentEl.querySelector(".simple-bible-fetcher-status")?.textContent
      ).toBe("No results.")
    );
  });

  it("shows the error in the status line when the search fails", async () => {
    useApi(createApi({ fail: (url) => url.includes("/find/") }));
    const plugin = await loadPlugin();

    command(plugin, "search-bible").editorCallback?.({ replaceSelection: vi.fn() });
    const modal = Modal.instances.at(-1);
    const input = modal?.contentEl.querySelector("input") as HTMLInputElement;
    input.value = "Liebe";
    pressEnter(input);

    await vi.waitFor(() =>
      expect(
        modal?.contentEl.querySelector(".simple-bible-fetcher-status")?.textContent
      ).toBe("Search failed (S00).")
    );
  });
});
