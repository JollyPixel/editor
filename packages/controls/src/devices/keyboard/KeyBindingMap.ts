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
    let keyBindings = new KeyBindingMap(defaults);
    const stored = parseJson(json);
    if (!isRecord(stored)) {
      return {
        keyBindings,
        dropped: ["Dropped the stored keybindings: not a JSON object"]
      };
    }

    const dropped: string[] = [];
    for (const [name, value] of Object.entries(stored)) {
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
      const chords = toList(overrides[action] ?? defaults[action])
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
      if (!sameChords(chords, toList(this.#defaults[action]))) {
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

  #accept(
    name: string,
    value: unknown
  ): KeyBindingMap<TAction> | string {
    const action = this.actions.find((known) => known === name);
    if (action === undefined) {
      return "unknown action";
    }
    if (!isChordList(value)) {
      return "not a string or a list of strings";
    }

    try {
      return this.rebind(action, value);
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

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value);
}

function isChordList(
  value: unknown
): value is string | string[] {
  return typeof value === "string" || (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function sameChords(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return left.length === right.length &&
    left.every((chord, index) => chord === right[index]);
}

function toList(
  value: string | readonly string[]
): readonly string[] {
  return typeof value === "string" ? [value] : value;
}
