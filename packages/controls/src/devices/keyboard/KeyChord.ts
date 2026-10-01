// Import Internal Dependencies
import {
  isKeyCode,
  type KeyCode
} from "./code.ts";
import {
  isKeyChordLetter,
  resolveKeyLetter,
  type KeyChordLetter
} from "./letter.ts";
import type { KeyboardLayout } from "./layout.ts";
import { isApplePlatform } from "../../platform.ts";
import { InvalidKeyChordError } from "./errors/InvalidKeyChordError.ts";

// CONSTANTS
const kNamedKeyLabels: Partial<Record<KeyCode, string>> = {
  Escape: "Esc",
  Delete: "Del",
  NumpadEnter: "Enter",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→"
};
const kPunctuationLabels: Partial<Record<KeyCode, string>> = {
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Backquote: "`"
};
const kPrintableCharacter = /^[^\s\p{C}]$/u;

export type KeyChordModifierPrefix =
  | ""
  | "Mod+"
  | "Shift+"
  | "Alt+"
  | "Mod+Shift+"
  | "Mod+Alt+"
  | "Shift+Alt+"
  | "Mod+Shift+Alt+";

export type KeyChordString =
  `${KeyChordModifierPrefix}${KeyCode | KeyChordLetter}`;

export type KeyChordEvent = Pick<
  KeyboardEvent,
  "code" | "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

export interface KeyChordPlatformOptions {
  apple?: boolean;
}

export interface KeyChordFormatOptions extends KeyChordPlatformOptions {
  layout?: KeyboardLayout | null;
}

export interface KeyChordModifiers {
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface KeyChordCodeOptions extends KeyChordModifiers {
  code: KeyCode;
  key?: never;
}

export interface KeyChordLetterOptions extends KeyChordModifiers {
  key: KeyChordLetter;
  code?: never;
}

export type KeyChordOptions = KeyChordCodeOptions | KeyChordLetterOptions;

export class KeyChord {
  static parse(
    chord: KeyChordString
  ): KeyChord {
    return KeyChord.from(chord);
  }

  static from(
    value: string
  ): KeyChord {
    const parts = value.split("+");
    const target = parts.pop() ?? "";
    const modifiers = {
      mod: parts.includes("Mod"),
      shift: parts.includes("Shift"),
      alt: parts.includes("Alt")
    };

    let chord: KeyChord | null = null;
    if (isKeyChordLetter(target)) {
      chord = new KeyChord({ ...modifiers, key: target });
    }
    else if (isKeyCode(target)) {
      chord = new KeyChord({ ...modifiers, code: target });
    }

    if (chord === null || chord.toString() !== value) {
      throw new InvalidKeyChordError(value);
    }

    return chord;
  }

  readonly code: KeyCode | null;
  readonly key: KeyChordLetter | null;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;

  constructor(
    options: KeyChordOptions
  ) {
    const {
      code = null,
      key = null,
      mod = false,
      shift = false,
      alt = false
    } = options;

    this.code = code;
    this.key = key;
    this.mod = mod;
    this.shift = shift;
    this.alt = alt;
  }

  matches(
    event: KeyChordEvent,
    options: KeyChordPlatformOptions = {}
  ): boolean {
    const { apple = isApplePlatform() } = options;
    const modKey = apple ? event.metaKey : event.ctrlKey;
    const otherKey = apple ? event.ctrlKey : event.metaKey;
    const target = this.key === null ?
      event.code === this.code :
      resolveKeyLetter(event) === this.key;

    return target &&
      modKey === this.mod &&
      !otherKey &&
      event.shiftKey === this.shift &&
      event.altKey === this.alt;
  }

  format(
    options: KeyChordFormatOptions = {}
  ): string {
    const {
      apple = isApplePlatform(),
      layout
    } = options;
    const key = this.#label(layout);

    if (apple) {
      return [
        this.alt ? "⌥" : "",
        this.shift ? "⇧" : "",
        this.mod ? "⌘" : "",
        key
      ].join("");
    }

    return [
      this.mod ? "Ctrl" : null,
      this.shift ? "Shift" : null,
      this.alt ? "Alt" : null,
      key
    ].filter((part) => part !== null).join("+");
  }

  toString(): KeyChordString {
    const prefix: KeyChordModifierPrefix = `${
      this.mod ? "Mod+" : ""
    }${
      this.shift ? "Shift+" : ""
    }${
      this.alt ? "Alt+" : ""
    }`;

    return `${prefix}${this.key ?? this.code ?? ""}` as KeyChordString;
  }

  #label(
    layout: KeyboardLayout | null = null
  ): string {
    if (this.key !== null) {
      return this.key.toUpperCase();
    }
    if (this.code === null) {
      return "";
    }

    return codeLabel(this.code, layout);
  }
}

function codeLabel(
  code: KeyCode,
  layout: KeyboardLayout | null
): string {
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  const named = kNamedKeyLabels[code];
  if (named !== undefined) {
    return named;
  }

  const qwerty = kPunctuationLabels[code] ??
    (code.startsWith("Key") ? code.slice(3) : null);
  if (qwerty === null) {
    return code;
  }

  const printed = layout?.get(code);

  return printed !== undefined && kPrintableCharacter.test(printed) ?
    printed.toLocaleUpperCase() :
    qwerty;
}

export type { KeyChordLetter } from "./letter.ts";
