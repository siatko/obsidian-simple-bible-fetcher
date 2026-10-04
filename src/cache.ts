export interface CacheStorage {
  read(): Promise<string | null>;
  write(data: string): Promise<void>;
}

interface CacheFile {
  schemaVersion: number;
  entries: Record<string, unknown>;
}

const SCHEMA_VERSION = 1;
const SAVE_DELAY_MS = 1500;

export class JsonCache {
  private entries = new Map<string, unknown>();
  private storage: CacheStorage;
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(storage: CacheStorage) {
    this.storage = storage;
  }

  async load(): Promise<void> {
    let raw: string | null = null;
    try {
      raw = await this.storage.read();
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Partial<CacheFile>;
      if (parsed.schemaVersion !== SCHEMA_VERSION || !parsed.entries) return;
      for (const key of Object.keys(parsed.entries)) {
        this.entries.set(key, parsed.entries[key]);
      }
    } catch {
      // A corrupt cache is ignored and overwritten on the next save.
    }
  }

  get<T>(key: string): T | undefined {
    return this.entries.get(key) as T | undefined;
  }

  set(key: string, value: unknown): void {
    this.entries.set(key, value);
    this.dirty = true;
    this.scheduleSave();
  }

  get size(): number {
    return this.entries.size;
  }

  private scheduleSave(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, SAVE_DELAY_MS);
  }

  async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const entries: Record<string, unknown> = {};
    for (const [key, value] of this.entries) entries[key] = value;
    try {
      await this.storage.write(
        JSON.stringify({ schemaVersion: SCHEMA_VERSION, entries })
      );
    } catch {
      this.dirty = true;
    }
  }
}
