// Import Internal Dependencies
import type { ControlTarget } from "../ControlTarget.js";

// CONSTANTS
const kControlKeys = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "PageUp", "PageDown", "Home", "End",
  "Insert", "Delete", "Tab", "Escape",
  "F1", "F2", "F3", "F4", "F5", "F6",
  "F7", "F8", "F9", "F10", "F11", "F12"
]);

export interface KeyState {
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustAutoRepeated: boolean;
  wasJustReleased: boolean;
}

export interface KeyboardOptions {
  eventProvider?: Document;
}

export class Keyboard implements ControlTarget {
  #eventProvider: Document;

  buttons = new Map<string, KeyState>();
  buttonsDown = new Set<string>();
  autoRepeatedCode: string | null = null;
  char = "";
  newChar = "";

  constructor(options: KeyboardOptions = {}) {
    const { eventProvider = document } = options;

    this.reset();
    this.#eventProvider = eventProvider;
  }

  connect() {
    this.#eventProvider.addEventListener("keydown", this.onKeyDown);
    this.#eventProvider.addEventListener("keypress", this.onKeyPress);
    this.#eventProvider.addEventListener("keyup", this.onKeyUp);
  }

  disconnect() {
    this.#eventProvider.removeEventListener("keydown", this.onKeyDown);
    this.#eventProvider.removeEventListener("keypress", this.onKeyPress);
    this.#eventProvider.removeEventListener("keyup", this.onKeyUp);
  }

  reset() {
    this.buttons.clear();
    this.buttonsDown.clear();
    this.char = "";
    this.newChar = "";
    this.autoRepeatedCode = null;
  }

  private onKeyDown = (event: KeyboardEvent) => {
    const isControlKey = kControlKeys.has(event.code);
    if (isControlKey) {
      event.preventDefault();
    }

    if (!this.buttons.has(event.code)) {
      this.buttons.set(event.code, {
        isDown: false,
        wasJustPressed: false,
        wasJustAutoRepeated: false,
        wasJustReleased: false
      });
    }

    if (this.buttonsDown.has(event.code)) {
      this.autoRepeatedCode = event.code;
    }
    else {
      this.buttonsDown.add(event.code);
    }

    return !isControlKey;
  };

  private onKeyPress = (event: KeyboardEvent) => {
    if (event.key.length === 1 && event.key.charCodeAt(0) >= 32) {
      this.newChar += event.key;
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.buttonsDown.delete(event.code);
  };

  update() {
    for (const [code, keyState] of this.buttons) {
      const wasDown = keyState.isDown;

      keyState.isDown = this.buttonsDown.has(code);
      keyState.wasJustPressed = !wasDown && keyState.isDown;
      keyState.wasJustAutoRepeated = false;
      keyState.wasJustReleased = wasDown && !keyState.isDown;
    }

    if (this.autoRepeatedCode !== null) {
      const keyState = this.buttons.get(this.autoRepeatedCode);
      if (keyState) {
        keyState.wasJustAutoRepeated = true;
      }
      this.autoRepeatedCode = null;
    }

    this.char = this.newChar;
    this.newChar = "";
  }
}
