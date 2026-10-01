// Import Third-party Dependencies
import {
  KeyBindingMap,
  type KeyBindingOverrides,
  type KeyChordString
} from "@jolly-pixel/controls";
import type { StorageAdapter } from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";
import * as z from "zod";

// Import Internal Dependencies
import {
  PIXEL_ART_KEY_BINDINGS,
  type PixelArtAction,
  type PixelArtKeyBindings
} from "./pixelArtKeyBindings.ts";

// CONSTANTS
export const KEY_BINDINGS_STORAGE_KEY = "pixel-art:keybindings";
const kStoredBindings = z.record(z.string(), z.unknown());
const kStoredEntry = z.union([
  z.string(),
  z.array(z.string())
]);

export interface KeyBindingSettingsOptions {
  storage: StorageAdapter;
  storageKey?: string;
  onDropped?: (message: string) => void;
}

export type KeyBindingSettingsEvents = {
  change: (keyBindings: PixelArtKeyBindings) => void;
};

export class KeyBindingSettings extends Emitter<KeyBindingSettingsEvents> {
  readonly #storage: StorageAdapter;
  readonly #storageKey: string;
  #keyBindings: PixelArtKeyBindings;

  constructor(
    options: KeyBindingSettingsOptions
  ) {
    super();

    this.#storage = options.storage;
    this.#storageKey = options.storageKey ?? KEY_BINDINGS_STORAGE_KEY;
    const { keyBindings, dropped } = readStored(
      this.#storage.get(this.#storageKey),
      options.onDropped ?? (() => undefined)
    );
    this.#keyBindings = keyBindings;
    if (dropped) {
      this.#save();
    }
  }

  get keyBindings(): PixelArtKeyBindings {
    return this.#keyBindings;
  }

  bindingsOf(
    action: PixelArtAction
  ): KeyChordString[] {
    return this.#keyBindings.chordsOf(action).map((chord) => chord.toString());
  }

  assign(
    action: PixelArtAction,
    bindings: readonly string[]
  ): void {
    this.#commit({
      ...this.#keyBindings.overrides,
      [action]: bindings
    });
  }

  reset(
    action?: PixelArtAction
  ): void {
    const overrides = action === undefined ? {} : this.#keyBindings.overrides;
    if (action !== undefined) {
      delete overrides[action];
    }

    this.#commit(overrides);
  }

  #commit(
    overrides: KeyBindingOverrides<PixelArtAction>
  ): void {
    this.#keyBindings = new KeyBindingMap(PIXEL_ART_KEY_BINDINGS, overrides);
    this.#save();
    this.emit("change", this.#keyBindings);
  }

  #save(): void {
    this.#storage.set(
      this.#storageKey,
      JSON.stringify(this.#keyBindings.overrides)
    );
  }
}

interface StoredKeyBindings {
  keyBindings: PixelArtKeyBindings;
  dropped: boolean;
}

function readStored(
  raw: string | null,
  onDropped: (message: string) => void
): StoredKeyBindings {
  let keyBindings: PixelArtKeyBindings = new KeyBindingMap(
    PIXEL_ART_KEY_BINDINGS
  );
  if (raw === null) {
    return {
      keyBindings,
      dropped: false
    };
  }

  const stored = kStoredBindings.safeParse(parseJson(raw));
  if (!stored.success) {
    onDropped("Dropped the stored keybindings: not a JSON object");

    return {
      keyBindings,
      dropped: true
    };
  }

  let dropped = false;
  for (const [name, value] of Object.entries(stored.data)) {
    const accepted = acceptEntry(keyBindings, name, value);
    if (typeof accepted === "string") {
      onDropped(`Dropped the stored keybinding "${name}": ${accepted}`);
      dropped = true;
    }
    else {
      keyBindings = accepted;
    }
  }

  return {
    keyBindings,
    dropped
  };
}

function acceptEntry(
  keyBindings: PixelArtKeyBindings,
  name: string,
  value: unknown
): PixelArtKeyBindings | string {
  const action = keyBindings.actions.find((known) => known === name);
  if (action === undefined) {
    return "unknown action";
  }

  const entry = kStoredEntry.safeParse(value);
  if (!entry.success) {
    return "not a string or a list of strings";
  }

  try {
    return new KeyBindingMap(PIXEL_ART_KEY_BINDINGS, {
      ...keyBindings.overrides,
      [action]: entry.data
    });
  }
  catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function parseJson(
  raw: string
): unknown {
  try {
    return JSON.parse(raw);
  }
  catch {
    return null;
  }
}
