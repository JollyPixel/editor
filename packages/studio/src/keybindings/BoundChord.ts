// Import Third-party Dependencies
import {
  KeyChord,
  isApplePlatform,
  isKeyCode,
  type KeyChordEvent,
  type KeyboardLayout
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
  /**
   * Names a key position by the character the user's keyboard prints.
   * @default null
   */
  layout?: KeyboardLayout | null;
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

  readonly chord: KeyChord;
  readonly value: string;
  readonly label: string;

  constructor(
    chord: KeyChord,
    options: BoundChordOptions = {}
  ) {
    this.chord = chord;
    this.value = chord.toString();
    this.label = chord.format({
      apple: options.apple,
      layout: options.layout
    });
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
