export type SettingDefinitionItem = unknown;

export interface RequestUrlOptions {
  url: string;
}

export interface RequestUrlResponse {
  status: number;
  json: unknown;
}

export type RequestUrlHandler = (
  options: RequestUrlOptions
) => Promise<RequestUrlResponse>;

let requestUrlHandler: RequestUrlHandler = async () => ({
  status: 404,
  json: null,
});

export function setRequestUrlHandler(next: RequestUrlHandler): void {
  requestUrlHandler = next;
}

export function resetRequestUrlHandler(): void {
  requestUrlHandler = async () => ({ status: 404, json: null });
}

export async function requestUrl(
  options: RequestUrlOptions
): Promise<RequestUrlResponse> {
  return requestUrlHandler(options);
}

export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/|\/$/g, "");
}

export class StubVault {
  configDir = ".obsidian";
  adapter = {};
  files = new Map<string, string>();
  folders = new Set<string>();

  getAbstractFileByPath(path: string): { path: string } | null {
    const normalized = normalizePath(path);
    if (this.files.has(normalized) || this.folders.has(normalized)) {
      return { path: normalized };
    }
    return null;
  }

  getFileByPath(path: string): { path: string } | null {
    const normalized = normalizePath(path);
    return this.files.has(normalized) ? { path: normalized } : null;
  }

  async createFolder(path: string): Promise<void> {
    this.folders.add(normalizePath(path));
  }

  async create(path: string, content: string): Promise<{ path: string }> {
    const normalized = normalizePath(path);
    this.files.set(normalized, content);
    return { path: normalized };
  }
}

export class StubWorkspace {
  opened: Array<{ link: string; source: string; newLeaf: string | boolean }> =
    [];
  openedFiles: Array<{
    path: string;
    mode: string;
    direction?: string;
    state?: unknown;
  }> = [];
  activeFile: { path: string } | null = null;

  getActiveFile(): { path: string } | null {
    return this.activeFile;
  }

  async openLinkText(
    linktext: string,
    source: string,
    newLeaf?: string | boolean
  ): Promise<void> {
    this.opened.push({ link: linktext, source, newLeaf: newLeaf ?? false });
  }

  getLeaf(
    type?: string,
    direction?: string
  ): { openFile: (file: { path: string }, state?: unknown) => Promise<void> } {
    const openedFiles = this.openedFiles;
    return {
      async openFile(file: { path: string }, state?: unknown): Promise<void> {
        openedFiles.push({
          path: file.path,
          mode: type ?? "default",
          direction,
          state,
        });
      },
    };
  }
}

export class App {
  vault = new StubVault();
  workspace = new StubWorkspace();
}

export interface Editor {
  replaceSelection(text: string): void;
}

export class Notice {
  static instances: Notice[] = [];

  message: string;

  constructor(message: string) {
    this.message = message;
    Notice.instances.push(this);
  }

  static reset(): void {
    Notice.instances = [];
  }
}

export class Modal {
  static instances: Modal[] = [];

  app: unknown;
  contentEl: HTMLElement;
  containerEl: HTMLElement;
  closed = false;

  constructor(app: unknown) {
    this.app = app;
    this.contentEl = document.createElement("div");
    this.containerEl = document.createElement("div");
    Modal.instances.push(this);
  }

  open(): void {
    this.onOpen();
  }

  close(): void {
    this.closed = true;
    this.onClose();
  }

  onOpen(): void {}

  onClose(): void {}

  static reset(): void {
    Modal.instances = [];
  }
}

export interface CommandRecord {
  id: string;
  name: string;
  editorCallback?: (editor: Editor) => unknown;
}

export class Plugin {
  app: unknown;
  manifest: unknown;
  commands: CommandRecord[] = [];
  settingTabs: PluginSettingTab[] = [];
  private data: unknown = null;

  constructor(app: unknown, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }

  async loadData(): Promise<unknown> {
    if (this.data === null || this.data === undefined) return this.data;
    return JSON.parse(JSON.stringify(this.data));
  }

  async saveData(data: unknown): Promise<void> {
    this.data = data === undefined ? null : JSON.parse(JSON.stringify(data));
  }

  setData(data: unknown): void {
    this.data = data === undefined ? null : JSON.parse(JSON.stringify(data));
  }

  addCommand(command: CommandRecord): CommandRecord {
    this.commands.push(command);
    return command;
  }

  addSettingTab(tab: PluginSettingTab): void {
    this.settingTabs.push(tab);
  }

  registerEvent(): void {}

  registerDomEvent(
    el: EventTarget,
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions
  ): void {
    el.addEventListener(type, callback, options);
    domListeners.push({ el, type, callback, options });
  }
}

const domListeners: Array<{
  el: EventTarget;
  type: string;
  callback: EventListenerOrEventListenerObject;
  options?: boolean | AddEventListenerOptions;
}> = [];

export function resetDomEvents(): void {
  for (const listener of domListeners) {
    listener.el.removeEventListener(
      listener.type,
      listener.callback,
      listener.options
    );
  }
  domListeners.length = 0;
}

export class PluginSettingTab {
  app: unknown;
  plugin: { settings?: Record<string, unknown> };
  containerEl: HTMLElement;
  updates = 0;

  constructor(app: unknown, plugin: { settings?: Record<string, unknown> }) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement("div");
  }

  getSettingDefinitions(): unknown[] {
    return [];
  }

  getControlValue(key: string): unknown {
    return this.plugin.settings?.[key];
  }

  setControlValue(key: string, value: unknown): void {
    if (this.plugin.settings) this.plugin.settings[key] = value;
  }

  update(): void {
    this.updates += 1;
  }

  display(): void {}
}

export class StubComponent {
  value: unknown;
  options: Array<{ value: string; label: string }> = [];
  private changeHandler: ((value: unknown) => unknown) | null = null;

  addOption(value: string, label?: string): this {
    this.options.push({ value, label: label ?? value });
    return this;
  }

  setValue(value: unknown): this {
    this.value = value;
    return this;
  }

  onChange(handler: (value: unknown) => unknown): this {
    this.changeHandler = handler;
    return this;
  }

  async trigger(value: unknown): Promise<void> {
    this.value = value;
    if (this.changeHandler) await this.changeHandler(value);
  }
}

export class Setting {
  components: StubComponent[] = [];

  constructor(public containerEl: HTMLElement) {}

  private addComponent(cb: (component: StubComponent) => unknown): this {
    const component = new StubComponent();
    this.components.push(component);
    const result = cb(component);
    if (result && typeof (result as Promise<unknown>).then === "function") {
      void result;
    }
    return this;
  }

  addDropdown(cb: (component: StubComponent) => unknown): this {
    return this.addComponent(cb);
  }

  addText(cb: (component: StubComponent) => unknown): this {
    return this.addComponent(cb);
  }

  addTextArea(cb: (component: StubComponent) => unknown): this {
    return this.addComponent(cb);
  }

  addToggle(cb: (component: StubComponent) => unknown): this {
    return this.addComponent(cb);
  }
}
