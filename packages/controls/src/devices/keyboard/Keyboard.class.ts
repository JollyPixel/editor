// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  InputControl,
  InputCustomAction
} from "../../types.ts";
import {
  BrowserDocumentAdapter,
  type DocumentAdapter
} from "./../../adapters/index.ts";
import {
  mapKeyToExtendedKey,
  type KeyCode,
  type ExtendedKeyCode
} from "./code.ts";

// CONSTANTS
/** `Tab` and `Escape` keep browser defaults but still emit key events. */
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

const kEditableTagNames = new Set([
  "INPUT",
  "TEXTAREA"
]);

function isEditableElement(
  target: unknown
): boolean {
  if (
    target === null ||
    typeof target !== "object"
  ) {
    return false;
  }

  if (
    "isContentEditable" in target &&
    target.isContentEditable === true
  ) {
    return true;
  }

  return "tagName" in target &&
    typeof target.tagName === "string" &&
    kEditableTagNames.has(target.tagName);
}

export interface KeyEventTargetLike {
  target?: unknown;
  composedPath?: () => readonly unknown[];
}

export function isEditableTarget(
  event: KeyEventTargetLike
): boolean {
  if (typeof event.composedPath === "function") {
    return event.composedPath().some(isEditableElement);
  }

  return isEditableElement(event.target);
}

export type KeyboardEvents =
  & Record<KeyCode, (event: KeyboardEvent) => void>
  & {
    down: (event: KeyboardEvent) => void;
    up: (event: KeyboardEvent) => void;
    press: (event: KeyboardEvent) => void;
  };

export interface KeyState {
  code: string;
  isDown: boolean;
  wasJustPressed: boolean;
  wasJustAutoRepeated: boolean;
  wasJustReleased: boolean;
}

export type InputKeyboardAction = ExtendedKeyCode | InputCustomAction;

export interface KeyboardOptions {
  documentAdapter?: DocumentAdapter;
}

export class Keyboard extends Emitter<
  KeyboardEvents
> implements InputControl {
  #documentAdapter: DocumentAdapter;

  #wasActive = false;
  #settled = true;
  #enabled = true;
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

  get enabled() {
    return this.#enabled;
  }

  set enabled(
    enabled: boolean
  ) {
    if (this.#enabled === enabled) {
      return;
    }

    this.#enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  connect() {
    this.#documentAdapter.addEventListener(
      "keydown",
      this.#onKeyDown
    );
    this.#documentAdapter.addEventListener(
      "keypress",
      this.#onKeyPress
    );
    this.#documentAdapter.addEventListener(
      "keyup",
      this.#onKeyUp
    );
  }

  disconnect() {
    this.#documentAdapter.removeEventListener(
      "keydown",
      this.#onKeyDown
    );
    this.#documentAdapter.removeEventListener(
      "keypress",
      this.#onKeyPress
    );
    this.#documentAdapter.removeEventListener(
      "keyup",
      this.#onKeyUp
    );
  }

  reset() {
    this.buttons.clear();
    this.buttonsDown.clear();
    this.char = "";
    this.newChar = "";
    this.autoRepeatedCode = null;
  }

  isDown(
    key: InputKeyboardAction
  ): boolean {
    if (key === "ANY") {
      return this.buttonsDown.size > 0;
    }
    if (key === "NONE") {
      return this.buttonsDown.size === 0;
    }

    return this.buttonsDown.has(
      mapKeyToExtendedKey(key)
    );
  }

  wasJustPressed(
    key: InputKeyboardAction
  ): boolean {
    if (key === "ANY") {
      return this.#anyButton("wasJustPressed");
    }
    if (key === "NONE") {
      return !this.#anyButton("wasJustPressed");
    }

    return this.buttons.get(
      mapKeyToExtendedKey(key)
    )?.wasJustPressed ?? false;
  }

  wasJustReleased(
    key: InputKeyboardAction
  ): boolean {
    if (key === "ANY") {
      return this.#anyButton("wasJustReleased");
    }
    if (key === "NONE") {
      return !this.#anyButton("wasJustReleased");
    }

    return this.buttons.get(
      mapKeyToExtendedKey(key)
    )?.wasJustReleased ?? false;
  }

  #anyButton(
    flag: "wasJustPressed" | "wasJustReleased"
  ): boolean {
    for (const button of this.buttons.values()) {
      if (button[flag]) {
        return true;
      }
    }

    return false;
  }

  wasJustAutoRepeated(
    key: ExtendedKeyCode
  ): boolean {
    return this.buttons.get(
      mapKeyToExtendedKey(key)
    )?.wasJustAutoRepeated ?? false;
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (
      !this.#enabled ||
      isEditableTarget(event)
    ) {
      return;
    }

    const isControlKey = kControlKeys.has(event.code);
    if (isControlKey) {
      event.preventDefault();
    }

    if (!this.buttons.has(event.code)) {
      this.buttons.set(event.code, {
        code: event.code,
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
    this.emit(event.code as KeyCode, event);
  };

  #onKeyPress = (event: KeyboardEvent) => {
    if (
      !this.#enabled ||
      isEditableTarget(event)
    ) {
      return;
    }

    if (
      event.key.length === 1 &&
      event.key.charCodeAt(0) >= 32
    ) {
      this.newChar += event.key;
      this.emit("press", event);
    }
  };

  #onKeyUp = (event: KeyboardEvent) => {
    if (!this.#enabled) {
      return;
    }

    this.buttonsDown.delete(event.code);
    this.emit("up", event);
  };

  update() {
    if (
      this.#settled &&
      this.buttonsDown.size === 0 &&
      this.autoRepeatedCode === null &&
      this.newChar === ""
    ) {
      return;
    }

    let active = 0;
    let settling = 0;

    for (const keyState of this.buttons.values()) {
      const wasDown = keyState.isDown;
      const isDown = this.buttonsDown.has(keyState.code);

      keyState.isDown = isDown;
      keyState.wasJustPressed = !wasDown && isDown;
      keyState.wasJustAutoRepeated = false;
      keyState.wasJustReleased = wasDown && !isDown;

      active |= Number(isDown);
      settling |= Number(keyState.wasJustPressed) | Number(keyState.wasJustReleased);
    }

    if (this.autoRepeatedCode !== null) {
      const keyState = this.buttons.get(this.autoRepeatedCode);
      if (keyState) {
        keyState.wasJustAutoRepeated = true;
        active |= 1;
        settling |= 1;
      }
      this.autoRepeatedCode = null;
    }

    this.char = this.newChar;
    this.newChar = "";

    this.#wasActive = active !== 0;
    this.#settled = active === 0 && settling === 0 && this.char === "";
  }
}

export type {
  KeyCode,
  ExtendedKeyCode
} from "./code.ts";
