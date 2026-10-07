// Import Third-party Dependencies
import {
  KeyBindingMap,
  type KeyBindingDefaults,
  type KeyBindingOverrides
} from "@jolly-pixel/controls";
import * as z from "zod";

// CONSTANTS
const kDefaults = Object.freeze({
  selectAll: "Mod+a",
  copy: "Mod+c",
  paste: "Mod+v",
  undo: "Mod+z",
  redo: ["Mod+y", "Mod+Shift+z"],
  delete: "Delete",
  rotate: "r",
  rotateCounterClockwise: "Shift+r",
  flipHorizontal: "h",
  flipVertical: "v"
} as const satisfies KeyBindingDefaults<string>);
const kStoredBindings = z.record(z.string(), z.unknown());
const kStoredEntry = z.union([
  z.string(),
  z.array(z.string())
]);

export type PixelArtAction = keyof typeof kDefaults;

export interface ParsedKeyBindings {
  keyBindings: PixelArtKeyBindings;
  dropped: string[];
}

export class PixelArtKeyBindings extends KeyBindingMap<PixelArtAction> {
  static readonly defaults = kDefaults;

  static parse(
    json: string
  ): ParsedKeyBindings {
    let keyBindings = new PixelArtKeyBindings();
    const stored = kStoredBindings.safeParse(parseJson(json));
    if (!stored.success) {
      return {
        keyBindings,
        dropped: ["Dropped the stored keybindings: not a JSON object"]
      };
    }

    const dropped: string[] = [];
    for (const [name, value] of Object.entries(stored.data)) {
      const accepted = keyBindings.#accept(name, value);
      if (typeof accepted === "string") {
        dropped.push(`Dropped the stored keybinding "${name}": ${accepted}`);
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

  constructor(
    overrides: KeyBindingOverrides<PixelArtAction> = {}
  ) {
    super(kDefaults, overrides);
  }

  rebind(
    action: PixelArtAction,
    chords: string | readonly string[]
  ): PixelArtKeyBindings {
    return new PixelArtKeyBindings({
      ...this.overrides,
      [action]: chords
    });
  }

  restore(
    action?: PixelArtAction
  ): PixelArtKeyBindings {
    if (action === undefined) {
      return new PixelArtKeyBindings();
    }

    const { [action]: _restored, ...overrides } = this.overrides;

    return new PixelArtKeyBindings(overrides);
  }

  toJSON(): KeyBindingOverrides<PixelArtAction> {
    return this.overrides;
  }

  #accept(
    name: string,
    value: unknown
  ): PixelArtKeyBindings | string {
    const action = this.actions.find((known) => known === name);
    if (action === undefined) {
      return "unknown action";
    }

    const entry = kStoredEntry.safeParse(value);
    if (!entry.success) {
      return "not a string or a list of strings";
    }

    try {
      return this.rebind(action, entry.data);
    }
    catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
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
