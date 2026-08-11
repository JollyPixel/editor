// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  InputControl
} from "../../types.ts";
import {
  BrowserDocumentAdapter,
  type DocumentAdapter
} from "../../../adapters/index.ts";

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

/**
 * `Tab` and `Escape` are deliberately absent. Preventing `Tab` traps focus on the canvas, so a
 * keyboard user can never reach surrounding UI, and preventing `Escape` suppresses the browser
 * default action native `dialog` closes on. Both still emit, so a consumer wanting the old
 * behaviour can call `keyboard.on("Tab", (event) => event.preventDefault())`.
 */

const kEditableTagNames = new Set([
  "INPUT",
  "TEXTAREA"
]);

function isEditableElement(
  target: unknown
): boolean {
  if (target === null || typeof target !== "object") {
    return false;
  }

  if ("isContentEditable" in target && target.isContentEditable === true) {
    return true;
  }

  return "tagName" in target &&
    typeof target.tagName === "string" &&
    kEditableTagNames.has(target.tagName);
}

/**
 * Whether a key event originated inside an editable control, in which case the engine must ignore
 * it so typing does not also drive the game.
 *
 * Resolved through `composedPath()`: shadow DOM retargets `event.target` to the host, so a control
 * inside a shadow root would otherwise report as its custom element. The whole path is scanned so
 * a text node inside a `contenteditable` ancestor still matches.
 */
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

export type KeyboardEvents = {
  down: (event: KeyboardEvent) => void;
  up: (event: KeyboardEvent) => void;
  press: (event: KeyboardEvent) => void;
  [key: string]: (event: KeyboardEvent) => void;
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

export class Keyboard extends Emitter<
  KeyboardEvents
> implements InputControl {
  #documentAdapter: DocumentAdapter;

  #wasActive = false;
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

  /** Disabling resets held keys so polling consumers see them release, instead of getting stuck "down". */
  setEnabled(
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
    this.#documentAdapter.addEventListener("keydown", this.#onKeyDown);
    this.#documentAdapter.addEventListener("keypress", this.#onKeyPress);
    this.#documentAdapter.addEventListener("keyup", this.#onKeyUp);
  }

  disconnect() {
    this.#documentAdapter.removeEventListener("keydown", this.#onKeyDown);
    this.#documentAdapter.removeEventListener("keypress", this.#onKeyPress);
    this.#documentAdapter.removeEventListener("keyup", this.#onKeyUp);
  }

  reset() {
    this.buttons.clear();
    this.buttonsDown.clear();
    this.char = "";
    this.newChar = "";
    this.autoRepeatedCode = null;
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (!this.#enabled || isEditableTarget(event)) {
      return;
    }

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
  };

  #onKeyPress = (event: KeyboardEvent) => {
    if (!this.#enabled || isEditableTarget(event)) {
      return;
    }

    if (event.key.length === 1 && event.key.charCodeAt(0) >= 32) {
      this.newChar += event.key;
      this.emit("press", event);
    }
  };

  /**
   * Not guarded by `isEditableTarget`, unlike keydown and keypress. Holding a key on the canvas
   * then focusing a field before releasing would otherwise leave it in `buttonsDown` forever.
   * Deleting a key that was never added is a no-op, so releases are always safe to process.
   */
  #onKeyUp = (event: KeyboardEvent) => {
    if (!this.#enabled) {
      return;
    }

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

export type { KeyCode, ExtendedKeyCode } from "./code.ts";
