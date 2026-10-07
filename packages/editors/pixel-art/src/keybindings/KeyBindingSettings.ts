// Import Third-party Dependencies
import type { KeyChordString } from "@jolly-pixel/controls";
import type { StorageAdapter } from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  PixelArtKeyBindings,
  type PixelArtAction
} from "./PixelArtKeyBindings.ts";

// CONSTANTS
export const KEY_BINDINGS_STORAGE_KEY = "pixel-art:keybindings";

export interface KeyBindingSettingsOptions {
  storage: StorageAdapter;
  storageKey?: string;
  onDropped?: (message: string) => void;
}

export type KeyBindingSettingsEvents = {
  change: (keyBindings: PixelArtKeyBindings) => void;
};

export interface KeyBindingsReceiver {
  keyBindings: PixelArtKeyBindings;
}

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
    const raw = this.#storage.get(this.#storageKey);
    if (raw === null) {
      this.#keyBindings = new PixelArtKeyBindings();

      return;
    }

    const { keyBindings, dropped } = PixelArtKeyBindings.parse(raw);
    this.#keyBindings = keyBindings;
    if (dropped.length > 0) {
      for (const message of dropped) {
        options.onDropped?.(message);
      }
      this.#save();
    }
  }

  get keyBindings(): PixelArtKeyBindings {
    return this.#keyBindings;
  }

  bind(
    target: KeyBindingsReceiver
  ): () => void {
    target.keyBindings = this.#keyBindings;

    return this.subscribe("change", (keyBindings) => {
      target.keyBindings = keyBindings;
    });
  }

  chordsBoundTo(
    action: PixelArtAction
  ): KeyChordString[] {
    return this.#keyBindings.chordsOf(action).map((chord) => chord.toString());
  }

  assign(
    action: PixelArtAction,
    bindings: readonly string[]
  ): void {
    this.#commit(this.#keyBindings.rebind(action, bindings));
  }

  reset(
    action?: PixelArtAction
  ): void {
    this.#commit(this.#keyBindings.restore(action));
  }

  #commit(
    keyBindings: PixelArtKeyBindings
  ): void {
    this.#keyBindings = keyBindings;
    this.#save();
    this.emit("change", keyBindings);
  }

  #save(): void {
    this.#storage.set(
      this.#storageKey,
      JSON.stringify(this.#keyBindings)
    );
  }
}
