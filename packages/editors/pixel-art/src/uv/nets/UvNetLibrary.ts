// Import Third-party Dependencies
import {
  MemoryStorageAdapter,
  type StorageAdapter
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";
import { DEFAULT_UV_SLOTS } from "@jolly-pixel/pixel-draw.renderer";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  UvNetPreset,
  type UvNetPresetInit,
  type UvNetRowsInput
} from "./UvNetPreset.ts";

// CONSTANTS
export const UV_NETS_STORAGE_KEY = "pixel-art:uv-nets";
export const UV_NET_PRESETS: readonly UvNetPresetInit[] = Object.freeze([
  {
    id: "packed",
    name: "Packed",
    rows: null
  },
  {
    id: "cross",
    name: "Cross",
    rows: [
      [null, "top"],
      ["left", "front", "right", "back"],
      [null, "bottom"]
    ]
  }
]);
const kStoredLibrary = z.object({
  defaultId: z.catch(z.optional(z.string()), undefined),
  nets: z.catch(z.array(z.unknown()), [])
});
const kStoredNet = z.object({
  id: z.string(),
  name: z.string(),
  rows: z.array(
    z.array(z.nullable(z.array(z.string())))
  )
});

export type UvNetLibraryEvents = {
  change: () => void;
};

export interface UvNetLibraryOptions {
  storage?: StorageAdapter;
  presets?: readonly UvNetPresetInit[];
  defaultId?: string;
}

export interface UvNetChanges {
  name?: string;
  rows?: UvNetRowsInput;
}

export class UvNetLibrary
  extends Emitter<UvNetLibraryEvents>
  implements Iterable<UvNetPreset> {
  readonly #storage: StorageAdapter;
  readonly #locked: readonly UvNetPreset[];
  readonly #fallbackDefaultId: string;
  #custom: UvNetPreset[];
  #defaultId: string;

  constructor(
    options: UvNetLibraryOptions = {}
  ) {
    super();

    const {
      storage = new MemoryStorageAdapter(),
      presets = [],
      defaultId = UV_NET_PRESETS[0].id
    } = options;
    this.#storage = storage;
    this.#locked = [...UV_NET_PRESETS, ...presets].map(
      (init) => new UvNetPreset(init, true)
    );
    this.#fallbackDefaultId = this.#locked.some((preset) => preset.id === defaultId) ?
      defaultId :
      UV_NET_PRESETS[0].id;

    const stored = UvNetLibrary.#parse(storage.get(UV_NETS_STORAGE_KEY));
    this.#custom = stored.nets.filter(
      (preset) => !this.#locked.some((locked) => locked.id === preset.id)
    );
    this.#defaultId = stored.defaultId !== undefined && this.get(stored.defaultId) ?
      stored.defaultId :
      this.#fallbackDefaultId;
  }

  * [Symbol.iterator](): IterableIterator<UvNetPreset> {
    yield* this.#locked;
    yield* this.#custom;
  }

  get default(): UvNetPreset {
    return this.get(this.#defaultId)!;
  }

  get defaultId(): string {
    return this.#defaultId;
  }

  set defaultId(
    id: string
  ) {
    if (id === this.#defaultId || this.get(id) === undefined) {
      return;
    }

    this.#defaultId = id;
    this.#commit();
  }

  get(
    id: string
  ): UvNetPreset | undefined {
    return this.#locked.find((preset) => preset.id === id) ??
      this.#custom.find((preset) => preset.id === id);
  }

  create(
    name: string,
    rows: UvNetRowsInput = [DEFAULT_UV_SLOTS]
  ): UvNetPreset {
    const preset = new UvNetPreset({
      id: crypto.randomUUID(),
      name,
      rows
    });
    this.#custom = [...this.#custom, preset];
    this.#commit();

    return preset;
  }

  duplicate(
    id: string
  ): UvNetPreset | null {
    const source = this.get(id);
    if (source === undefined) {
      return null;
    }

    return this.create(
      `${source.name} copy`,
      source.rows ?? [DEFAULT_UV_SLOTS]
    );
  }

  update(
    id: string,
    changes: UvNetChanges
  ): boolean {
    const index = this.#custom.findIndex((preset) => preset.id === id);
    if (index === -1) {
      return false;
    }

    let next: UvNetPreset;
    try {
      next = this.#custom[index].with(changes);
    }
    catch {
      return false;
    }

    this.#custom = this.#custom.with(index, next);
    this.#commit();

    return true;
  }

  delete(
    id: string
  ): boolean {
    if (!this.#custom.some((preset) => preset.id === id)) {
      return false;
    }

    this.#custom = this.#custom.filter((preset) => preset.id !== id);
    if (this.#defaultId === id) {
      this.#defaultId = this.#fallbackDefaultId;
    }
    this.#commit();

    return true;
  }

  #commit(): void {
    this.#storage.set(
      UV_NETS_STORAGE_KEY,
      JSON.stringify({
        defaultId: this.#defaultId,
        nets: this.#custom
      })
    );
    this.emit("change");
  }

  static #parse(
    raw: string | null
  ): { defaultId?: string; nets: UvNetPreset[]; } {
    let stored: z.infer<typeof kStoredLibrary>;
    try {
      stored = kStoredLibrary.parse(JSON.parse(raw ?? "{}"));
    }
    catch {
      return { nets: [] };
    }

    const nets: UvNetPreset[] = [];
    for (const value of stored.nets) {
      const net = kStoredNet.safeParse(value);
      if (!net.success) {
        continue;
      }
      try {
        nets.push(new UvNetPreset(net.data));
      }
      catch {
        continue;
      }
    }

    return {
      defaultId: stored.defaultId,
      nets
    };
  }
}
