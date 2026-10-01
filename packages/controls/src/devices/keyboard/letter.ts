// Import Internal Dependencies
import type { Alphabet } from "./transformers/alphabet.ts";

// CONSTANTS
const kLetter = /^[a-z]$/;

export type KeyChordLetter = Lowercase<Alphabet>;

export interface KeyLetterEvent {
  code: string;
  key: string;
}

export function isKeyChordLetter(
  value: string
): value is KeyChordLetter {
  return kLetter.test(value);
}

export function resolveKeyLetter(
  event: KeyLetterEvent
): KeyChordLetter | null {
  const printed = event.key.toLowerCase();
  if (isKeyChordLetter(printed)) {
    return printed;
  }

  const physical = event.code.startsWith("Key") ?
    event.code.slice(3).toLowerCase() :
    "";

  return isKeyChordLetter(physical) ? physical : null;
}
