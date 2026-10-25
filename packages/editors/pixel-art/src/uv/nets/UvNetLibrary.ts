// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  DEFAULT_UV_SLOTS,
  SavedUVNet,
  type PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import {
  UvNetPreset,
  type UvNetPresetInit,
  type UvNetRowsInput
} from "./UvNetPreset.ts";

// CONSTANTS
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

export type UvNetLibraryEvents = {
  change: () => void;
};

export type UvNetDocument = Pick<
  PixelDocument,
  | "uvNets"
  | "saveUvNet"
  | "deleteUvNet"
  | "changeDefaultUvNet"
  | "subscribe"
>;

export interface UvNetLibraryOptions {
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
  readonly #locked: readonly UvNetPreset[];
  readonly #fallbackDefaultId: string;
  #document: UvNetDocument | null = null;
  #release: (() => void) | null = null;
  #custom: readonly UvNetPreset[] = [];

  constructor(
    options: UvNetLibraryOptions = {}
  ) {
    super();

    const {
      presets = [],
      defaultId = UV_NET_PRESETS[0].id
    } = options;
    this.#locked = [...UV_NET_PRESETS, ...presets].map(
      (init) => UvNetPreset.locked(init)
    );
    this.#fallbackDefaultId = this.#isLocked(defaultId) ?
      defaultId :
      UV_NET_PRESETS[0].id;
  }

  * [Symbol.iterator](): IterableIterator<UvNetPreset> {
    yield* this.#locked;
    yield* this.#custom;
  }

  get document(): UvNetDocument | null {
    return this.#document;
  }

  set document(
    document: UvNetDocument | null
  ) {
    if (document === this.#document) {
      return;
    }

    this.#release?.();
    this.#document = document;
    this.#release = document?.subscribe("uv-nets-changed", this.#refresh) ?? null;
    this.#refresh();
  }

  get default(): UvNetPreset {
    return this.get(this.defaultId)!;
  }

  get defaultId(): string {
    const id = this.#document?.uvNets.defaultId ?? null;

    return id !== null && this.get(id) !== undefined ? id : this.#fallbackDefaultId;
  }

  changeDefault(
    id: string
  ): boolean {
    if (this.#document === null || this.get(id) === undefined) {
      return false;
    }
    if (id !== this.defaultId) {
      this.#document.changeDefaultUvNet(id);
    }

    return true;
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
  ): UvNetPreset | null {
    if (this.#document === null) {
      return null;
    }

    const saved = new SavedUVNet({
      id: crypto.randomUUID(),
      name,
      rows
    });
    this.#document.saveUvNet(saved.toJSON());

    return new UvNetPreset(saved);
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
    const document = this.#document;
    const saved = this.#isLocked(id) ? undefined : document?.uvNets.get(id);
    if (document === null || saved === undefined) {
      return false;
    }

    let next: SavedUVNet;
    try {
      next = saved.with(changes);
    }
    catch {
      return false;
    }

    document.saveUvNet(next.toJSON());

    return true;
  }

  delete(
    id: string
  ): boolean {
    const document = this.#document;
    if (
      document === null ||
      this.#isLocked(id) ||
      document.uvNets.get(id) === undefined
    ) {
      return false;
    }

    document.deleteUvNet(id);

    return true;
  }

  #isLocked(
    id: string
  ): boolean {
    return this.#locked.some((preset) => preset.id === id);
  }

  readonly #refresh = (): void => {
    this.#custom = [...this.#document?.uvNets ?? []]
      .filter((saved) => !this.#isLocked(saved.id))
      .map((saved) => new UvNetPreset(saved));
    this.emit("change");
  };
}
