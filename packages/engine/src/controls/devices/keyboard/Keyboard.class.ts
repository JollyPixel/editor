// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import type {
  InputControl
} from "../../types.js";
import {
  BrowserDocumentAdapter,
  type DocumentAdapter
} from "../../../adapters/index.js";

// CONSTANTS
const kControlKeys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  "Insert",
  "Delete",
  "Tab",
  "Escape",
  "F1",
  "F2",
  "F3",
  "F4",
  "F5",
  "F6",
  "F7",
  "F8",
  "F9",
  "F10",
  "F11",
  "F12",
  "F13",
  "F14",
  "F15",
  "F16",
  "F17",
  "F18",
  "F19",
  "F20",
  "F21",
  "F22",
  "F23",
  "F24"
]);

export type KeyboardEvents = {
  down: [event: KeyboardEvent];
  up: [event: KeyboardEvent];
  press: [event: KeyboardEvent];
  [key: string]: [event: KeyboardEvent];
};

export interface KeyState {
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustAutoRepeated: boolean;
  wasJustReleased: boolean;
}

export interface KeyboardOptions {
  documentAdapter?: DocumentAdapter;
}

export class Keyboard extends EventEmitter<
  KeyboardEvents
> implements InputControl {
  #documentAdapter: DocumentAdapter;

  #wasActive = false;
  buttons = new Map<string, KeyState>();
  buttonsDown = new Set<string>();
  autoRepeatedCode: string | null = null;
  char = "";
  newChar = "";

  constructor(
    options: KeyboardOptions = {}
  ) {
    super();
    const {
      documentAdapter = new BrowserDocumentAdapter()
    } = options;

    this.reset();
    this.#documentAdapter = documentAdapter;
  }

  get wasActive() {
    return this.#wasActive;
  }

  connect() {
    this.#documentAdapter.addEventListener("keydown", this.onKeyDown);
    this.#documentAdapter.addEventListener("keypress", this.onKeyPress);
    this.#documentAdapter.addEventListener("keyup", this.onKeyUp);
  }

  disconnect() {
    this.#documentAdapter.removeEventListener("keydown", this.onKeyDown);
    this.#documentAdapter.removeEventListener("keypress", this.onKeyPress);
    this.#documentAdapter.removeEventListener("keyup", this.onKeyUp);
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
    this.emit("down", event);
    this.emit(event.code, event);

    return !isControlKey;
  };

  private onKeyPress = (event: KeyboardEvent) => {
    if (event.key.length === 1 && event.key.charCodeAt(0) >= 32) {
      this.newChar += event.key;
      this.emit("press", event);
    }
  };

  private onKeyUp = (event: KeyboardEvent) => {
    this.buttonsDown.delete(event.code);
    this.emit("up", event);
  };

  update() {
    this.#wasActive = false;

    for (const [code, keyState] of this.buttons) {
      const wasDown = keyState.isDown;
      const isDown = this.buttonsDown.has(code);

      keyState.isDown = isDown;
      keyState.wasJustPressed = !wasDown && keyState.isDown;
      keyState.wasJustAutoRepeated = false;
      keyState.wasJustReleased = wasDown && !keyState.isDown;

      if (isDown) {
        this.#wasActive = true;
      }
    }

    if (this.autoRepeatedCode !== null) {
      const keyState = this.buttons.get(this.autoRepeatedCode);
      if (keyState) {
        keyState.wasJustAutoRepeated = true;
        this.#wasActive = true;
      }
      this.autoRepeatedCode = null;
    }

    this.char = this.newChar;
    this.newChar = "";
  }
}

export type { KeyCode, ExtendedKeyCode } from "./code.js";
