// Import Internal Dependencies
import type { KeyCode } from "./code.ts";
import { isApplePlatform } from "../../platform.ts";

// CONSTANTS
const kKeyLabels: Partial<Record<KeyCode, string>> = {
  Escape: "Esc",
  Delete: "Del",
  NumpadEnter: "Enter",
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
  Backquote: "`",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→"
};

export type KeyChordModifierPrefix =
  | ""
  | "Mod+"
  | "Shift+"
  | "Alt+"
  | "Mod+Shift+"
  | "Mod+Alt+"
  | "Shift+Alt+"
  | "Mod+Shift+Alt+";

export type KeyChordString = `${KeyChordModifierPrefix}${KeyCode}`;

export type KeyChordEvent = Pick<
  KeyboardEvent,
  "code" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey"
>;

export interface KeyChordPlatformOptions {
  apple?: boolean;
}

export interface KeyChordOptions {
  code: KeyCode;
  mod?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export class KeyChord {
  static parse(
    chord: KeyChordString
  ): KeyChord {
    const parts = chord.split("+");
    const code = parts.pop() as KeyCode;

    return new KeyChord({
      code,
      mod: parts.includes("Mod"),
      shift: parts.includes("Shift"),
      alt: parts.includes("Alt")
    });
  }

  readonly code: KeyCode;
  readonly mod: boolean;
  readonly shift: boolean;
  readonly alt: boolean;

  constructor(
    options: KeyChordOptions
  ) {
    const {
      code,
      mod = false,
      shift = false,
      alt = false
    } = options;

    this.code = code;
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

    return event.code === this.code &&
      modKey === this.mod &&
      !otherKey &&
      event.shiftKey === this.shift &&
      event.altKey === this.alt;
  }

  format(
    options: KeyChordPlatformOptions = {}
  ): string {
    const { apple = isApplePlatform() } = options;
    const key = keyLabel(this.code);

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
}

function keyLabel(
  code: KeyCode
): string {
  const label = kKeyLabels[code];
  if (label !== undefined) {
    return label;
  }
  if (code.startsWith("Key")) {
    return code.slice(3);
  }
  if (code.startsWith("Digit")) {
    return code.slice(5);
  }

  return code;
}
