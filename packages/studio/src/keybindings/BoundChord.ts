// Import Third-party Dependencies
import {
  KEY_CODES,
  KeyChord,
  isApplePlatform,
  type KeyChordEvent,
  type KeyCode
} from "@jolly-pixel/controls";

// CONSTANTS
const kModifierKeys = new Set(["Shift", "Control", "Alt", "Meta", "AltGraph"]);
const kLetterCode = /^Key([A-Z])$/;
const kLetter = /^[a-z]$/;

export interface BoundChordOptions {
  /**
   * @default isApplePlatform()
   */
  apple?: boolean;
}

export class BoundChord {
  static capture(
    event: KeyChordEvent,
    options: BoundChordOptions = {}
  ): BoundChord | null {
    if (kModifierKeys.has(event.key)) {
      return null;
    }

    const { apple = isApplePlatform() } = options;
    const target = typedLetter(event) ??
      (isKeyCode(event.code) ? event.code : null);
    if (target === null) {
      return null;
    }

    const mod = apple ? event.metaKey : event.ctrlKey;
    const prefix = `${mod ? "Mod+" : ""}${event.shiftKey ? "Shift+" : ""}${event.altKey ? "Alt+" : ""}`;

    return BoundChord.parse(prefix + target, options);
  }

  static parse(
    text: string,
    options: BoundChordOptions = {}
  ): BoundChord | null {
    try {
      return new BoundChord(KeyChord.from(text), options);
    }
    catch {
      return null;
    }
  }

  readonly value: string;
  readonly label: string;

  constructor(
    chord: KeyChord,
    options: BoundChordOptions = {}
  ) {
    this.value = chord.toString();
    this.label = chord.format({ apple: options.apple });
  }
}

function typedLetter(
  event: KeyChordEvent
): string | null {
  const typed = event.key.toLowerCase();
  if (kLetter.test(typed)) {
    return typed;
  }

  return kLetterCode.exec(event.code)?.[1].toLowerCase() ?? null;
}

function isKeyCode(
  code: string
): code is KeyCode {
  return KEY_CODES.some((known) => known === code);
}
