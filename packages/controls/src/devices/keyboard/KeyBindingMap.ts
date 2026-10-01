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

export interface KeyBindingTarget {
  bind(
    chords: KeyBindingChords,
    handler: KeyBindingHandler,
    options?: KeyBindingOptions
  ): () => void;
}

export class KeyBindingMap<TAction extends string> {
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
      const chords = listOf(overrides[action] ?? defaults[action])
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
      const chords = this.chordsOf(action).map((chord) => chord.toString());
      if (!sameChords(chords, listOf(this.#defaults[action]))) {
        overrides[action] = chords;
      }
    }

    return overrides;
  }

  chordsOf(
    action: TAction
  ): readonly KeyChord[] {
    return this.#chords.get(action) ?? [];
  }

  format(
    action: TAction,
    options: KeyChordFormatOptions = {}
  ): string[] {
    return this.chordsOf(action).map((chord) => chord.format(options));
  }

  bind(
    target: KeyBindingTarget,
    handlers: KeyBindingHandlers<TAction>,
    options: KeyBindingOptions = {}
  ): () => void {
    const releases = this.actions.map((action) => target.bind(
      this.chordsOf(action),
      handlers[action],
      options
    ));

    return () => {
      for (const release of releases) {
        release();
      }
    };
  }
}

function sameChords(
  left: readonly string[],
  right: readonly string[]
): boolean {
  return left.length === right.length &&
    left.every((chord, index) => chord === right[index]);
}

function listOf(
  value: string | readonly string[]
): readonly string[] {
  return typeof value === "string" ? [value] : value;
}
