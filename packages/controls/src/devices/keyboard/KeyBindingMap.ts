// Import Internal Dependencies
import {
  KeyChord,
  type KeyChordFormatOptions,
  type KeyChordString
} from "./KeyChord.ts";
import type {
  KeyBindingChords,
  KeyBindingHandler,
  KeyBindingOptions
} from "./KeyBindings.ts";
import { KeyChordConflictError } from "./errors/KeyChordConflictError.ts";

export type KeyBindingDefaults<TAction extends string> = Readonly<
  Record<TAction, KeyChordString | readonly KeyChordString[]>
>;

export type KeyBindingOverrides<TAction extends string> = Partial<
  Record<TAction, string | readonly string[]>
>;

export type KeyBindingHandlers<TAction extends string> = Readonly<
  Record<TAction, KeyBindingHandler>
>;

export interface ParsedKeyBindings<TAction extends string> {
  keyBindings: KeyBindingMap<TAction>;
  dropped: string[];
}

export interface KeyBindingTarget {
  bind(
    chords: KeyBindingChords,
    handler: KeyBindingHandler,
    options?: KeyBindingOptions
  ): () => void;
}

export class KeyBindingMap<TAction extends string> {
  static parse<TAction extends string>(
    defaults: KeyBindingDefaults<TAction>,
    json: string
  ): ParsedKeyBindings<TAction> {
    try {
      return KeyBindingMap.from(defaults, JSON.parse(json));
    }
    catch {
      return KeyBindingMap.from(defaults, null);
    }
  }

  static from<TAction extends string>(
    defaults: KeyBindingDefaults<TAction>,
    stored: unknown
  ): ParsedKeyBindings<TAction> {
    let keyBindings = new KeyBindingMap(defaults);
    if (typeof stored !== "object" || stored === null || Array.isArray(stored)) {
      return {
        keyBindings,
        dropped: ["Dropped the stored keybindings: not a JSON object"]
      };
    }

    const dropped: string[] = [];
    const overrides: KeyBindingOverrides<TAction> = {};
    for (const [name, value] of Object.entries(stored)) {
      const action = keyBindings.actions.find((known) => known === name);
      const chords: unknown[] = [value].flat();
      if (action === undefined) {
        dropped.push(`Dropped the stored keybinding "${name}": unknown action`);
      }
      else if (chords.every((chord): chord is string => typeof chord === "string")) {
        overrides[action] = chords;
      }
      else {
        dropped.push(
          `Dropped the stored keybinding "${name}": not a string or a list of strings`
        );
      }
    }

    try {
      return {
        keyBindings: new KeyBindingMap(defaults, overrides),
        dropped
      };
    }
    catch {
      for (const action of keyBindings.actions) {
        const chords = overrides[action];
        if (chords === undefined) {
          continue;
        }

        try {
          keyBindings = keyBindings.rebind(action, chords);
        }
        catch (error) {
          const reason = error instanceof Error ? error.message : String(error);
          dropped.push(`Dropped the stored keybinding "${action}": ${reason}`);
        }
      }
    }

    return {
      keyBindings,
      dropped
    };
  }

  readonly actions: readonly TAction[];
  readonly #defaults: KeyBindingDefaults<TAction>;
  readonly #chords = new Map<TAction, readonly KeyChord[]>();

  constructor(
    defaults: KeyBindingDefaults<TAction>,
    overrides: KeyBindingOverrides<TAction> = {}
  ) {
    this.actions = Object.freeze(Object.keys(defaults) as TAction[]);
    this.#defaults = defaults;

    const owners = new Map<string, TAction>();
    for (const action of this.actions) {
      const chords = [overrides[action] ?? defaults[action]]
        .flat()
        .map((value) => KeyChord.from(value));

      for (const chord of chords) {
        const signature = chord.toString();
        const owner = owners.get(signature);
        if (owner !== undefined && owner !== action) {
          throw new KeyChordConflictError(signature, owner, action);
        }
        owners.set(signature, action);
      }
      this.#chords.set(action, Object.freeze(chords));
    }
  }

  get overrides(): Partial<Record<TAction, KeyChordString[]>> {
    const overrides: Partial<Record<TAction, KeyChordString[]>> = {};
    for (const action of this.actions) {
      const chords = this.chordsBoundTo(action).map((chord) => chord.toString());
      if (
        JSON.stringify(chords) !==
        JSON.stringify([this.#defaults[action]].flat())
      ) {
        overrides[action] = chords;
      }
    }

    return overrides;
  }

  chordsBoundTo(
    action: TAction
  ): readonly KeyChord[] {
    return this.#chords.get(action) ?? [];
  }

  format(
    action: TAction,
    options: KeyChordFormatOptions = {}
  ): string[] {
    return this.chordsBoundTo(action).map((chord) => chord.format(options));
  }

  rebind(
    action: TAction,
    chords: string | readonly string[]
  ): KeyBindingMap<TAction> {
    return new KeyBindingMap(this.#defaults, {
      ...this.overrides,
      [action]: chords
    });
  }

  restore(
    action?: TAction
  ): KeyBindingMap<TAction> {
    if (action === undefined) {
      return new KeyBindingMap(this.#defaults);
    }

    return new KeyBindingMap(this.#defaults, {
      ...this.overrides,
      [action]: this.#defaults[action]
    });
  }

  toJSON(): Partial<Record<TAction, KeyChordString[]>> {
    return this.overrides;
  }

  bind(
    target: KeyBindingTarget,
    handlers: Partial<KeyBindingHandlers<TAction>>,
    options: KeyBindingOptions = {}
  ): () => void {
    const releases = this.actions.flatMap((action) => {
      const handler = handlers[action];

      return handler === undefined ?
        [] :
        [target.bind(this.chordsBoundTo(action), handler, options)];
    });

    return () => {
      for (const release of releases) {
        release();
      }
    };
  }
}
