// Import Internal Dependencies
import {
  KeyChord,
  type KeyChordString
} from "./KeyChord.ts";
import { resolveKeyLetter } from "./letter.ts";

export type KeyBindingHandler = (event: KeyboardEvent) => boolean | void;

export type KeyBindingChord = KeyChord | KeyChordString;

export type KeyBindingChords = KeyBindingChord | readonly KeyBindingChord[];

export interface KeyBindingOptions {
  repeat?: boolean;
  priority?: number;
}

interface KeyBinding {
  chords: readonly KeyChord[];
  handler: KeyBindingHandler;
  repeat: boolean;
  priority: number;
  sequence: number;
}

export class KeyBindings {
  #byCode = new Map<string, KeyBinding[]>();
  #byLetter = new Map<string, KeyBinding[]>();
  #sequence = 0;

  bind(
    chords: KeyBindingChords,
    handler: KeyBindingHandler,
    options: KeyBindingOptions = {}
  ): () => void {
    const {
      repeat = false,
      priority = 0
    } = options;
    const binding: KeyBinding = {
      chords: toKeyChords(chords),
      handler,
      repeat,
      priority,
      sequence: this.#sequence++
    };
    const codes = new Set(binding.chords.flatMap((chord) => chord.code ?? []));
    const letters = new Set(binding.chords.flatMap((chord) => chord.key ?? []));

    for (const code of codes) {
      indexBinding(this.#byCode, code, binding);
    }
    for (const letter of letters) {
      indexBinding(this.#byLetter, letter, binding);
    }

    return () => {
      for (const code of codes) {
        unindexBinding(this.#byCode, code, binding);
      }
      for (const letter of letters) {
        unindexBinding(this.#byLetter, letter, binding);
      }
    };
  }

  dispatch(
    event: KeyboardEvent
  ): boolean {
    for (const binding of this.#candidates(event)) {
      if (
        (event.repeat && !binding.repeat) ||
        !binding.chords.some((chord) => chord.matches(event))
      ) {
        continue;
      }

      if (binding.handler(event) !== false) {
        event.preventDefault();

        return true;
      }
    }

    return false;
  }

  #candidates(
    event: KeyboardEvent
  ): KeyBinding[] {
    const letter = resolveKeyLetter(event);
    const byCode = this.#byCode.get(event.code) ?? [];
    const byLetter = letter === null ?
      [] :
      this.#byLetter.get(letter) ?? [];

    return [...new Set([...byCode, ...byLetter])].sort(compareBindings);
  }
}

function toKeyChords(
  chords: KeyBindingChords
): KeyChord[] {
  const list = typeof chords === "string" || chords instanceof KeyChord ?
    [chords] :
    chords;

  return list.map((chord) => (
    typeof chord === "string" ? KeyChord.parse(chord) : chord
  ));
}

function indexBinding(
  index: Map<string, KeyBinding[]>,
  slot: string,
  binding: KeyBinding
): void {
  const bindings = index.get(slot);
  if (bindings === undefined) {
    index.set(slot, [binding]);
  }
  else {
    bindings.push(binding);
  }
}

function unindexBinding(
  index: Map<string, KeyBinding[]>,
  slot: string,
  binding: KeyBinding
): void {
  const bindings = index.get(slot);
  if (bindings === undefined) {
    return;
  }

  const position = bindings.indexOf(binding);
  if (position !== -1) {
    bindings.splice(position, 1);
  }
  if (bindings.length === 0) {
    index.delete(slot);
  }
}

function compareBindings(
  left: KeyBinding,
  right: KeyBinding
): number {
  return right.priority - left.priority || left.sequence - right.sequence;
}
