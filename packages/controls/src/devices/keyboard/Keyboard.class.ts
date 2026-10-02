// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  InputControl,
  InputCustomAction,
  InputReader
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
import {
  KeyBindings,
  type KeyBindingChords,
  type KeyBindingHandler,
  type KeyBindingOptions
} from "./KeyBindings.ts";
import { KeyEdgeBuffer } from "./KeyEdgeBuffer.ts";

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

const kTextInputTypes = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "datetime-local",
  "month",
  "time",
  "week"
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

  if (!("tagName" in target)) {
    return false;
  }
  if (target.tagName === "TEXTAREA") {
    return true;
  }
  if (target.tagName !== "INPUT") {
    return false;
  }

  const type = "type" in target && typeof target.type === "string" ?
    target.type :
    "text";

  return kTextInputTypes.has(type);
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

export interface KeyboardGuard {
  blocks(event: KeyboardEvent): boolean;
  onEngage?(listener: () => void): () => void;
}

export interface KeyboardOptions {
  documentAdapter?: DocumentAdapter;
  preventControlKeys?: boolean;
}

export class Keyboard extends Emitter<
  KeyboardEvents
> implements InputControl {
  #documentAdapter: DocumentAdapter;
  #preventControlKeys: boolean;

  #wasActive = false;
  #enabled = true;
  #guards = new Map<KeyboardGuard, (() => void) | null>();
  #bindings = new KeyBindings();
  #suspensions = 0;
  #edges = new KeyEdgeBuffer();
  #publishedEdges = false;
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
      documentAdapter = new BrowserDocumentAdapter(),
      preventControlKeys = true
    } = options;

    this.reset();
    this.#documentAdapter = documentAdapter;
    this.#preventControlKeys = preventControlKeys;
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

  get suspended(): boolean {
    return this.#suspensions > 0;
  }

  suspend(): () => void {
    if (this.#suspensions === 0) {
      this.reset();
    }
    this.#suspensions++;

    let released = false;

    return () => {
      if (!released) {
        released = true;
        this.#suspensions--;
      }
    };
  }

  bind(
    chords: KeyBindingChords,
    handler: KeyBindingHandler,
    options: KeyBindingOptions = {}
  ): () => void {
    return this.#bindings.bind(chords, handler, options);
  }

  get #listening(): boolean {
    return this.#enabled && this.#suspensions === 0;
  }

  addGuard(
    guard: KeyboardGuard
  ): () => void {
    if (!this.#guards.has(guard)) {
      this.#guards.set(
        guard,
        guard.onEngage?.(this.#releaseHeldKeys) ?? null
      );
    }

    return () => this.#removeGuard(guard);
  }

  #removeGuard(
    guard: KeyboardGuard
  ): void {
    if (!this.#guards.has(guard)) {
      return;
    }

    this.#guards.get(guard)?.();
    this.#guards.delete(guard);
  }

  #releaseHeldKeys = () => {
    this.buttonsDown.clear();
    this.autoRepeatedCode = null;
  };

  #isBlocked(
    event: KeyboardEvent
  ): boolean {
    if (isEditableTarget(event)) {
      return true;
    }

    for (const guard of this.#guards.keys()) {
      if (guard.blocks(event)) {
        return true;
      }
    }

    return false;
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
    this.#edges.reset();
    this.#publishedEdges = false;
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
      !this.#listening ||
      this.#isBlocked(event)
    ) {
      return;
    }

    const isControlKey = kControlKeys.has(event.code);
    const isAltCombo = event.altKey && !isControlKey;
    if (
      this.#preventControlKeys &&
      (isControlKey || isAltCombo)
    ) {
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
    this.#bindings.dispatch(event);
  };

  #onKeyPress = (event: KeyboardEvent) => {
    if (
      !this.#listening ||
      this.#isBlocked(event)
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
    if (!this.#listening) {
      return;
    }

    this.buttonsDown.delete(event.code);
    this.emit("up", event);
  };

  update() {
    this.sample();
    this.publish("step");
  }

  sample(): void {
    if (
      !this.#wasActive &&
      this.buttonsDown.size === 0 &&
      this.autoRepeatedCode === null &&
      this.newChar === ""
    ) {
      return;
    }

    let active = 0;
    for (const keyState of this.buttons.values()) {
      const wasDown = keyState.isDown;
      const isDown = this.buttonsDown.has(keyState.code);

      keyState.isDown = isDown;
      if (!wasDown && isDown) {
        this.#edges.push("pressed", keyState.code);
      }
      else if (wasDown && !isDown) {
        this.#edges.push("released", keyState.code);
      }
      active |= Number(isDown);
    }

    if (
      this.autoRepeatedCode !== null &&
      this.buttons.has(this.autoRepeatedCode)
    ) {
      this.#edges.push("autoRepeated", this.autoRepeatedCode);
      active |= 1;
    }
    this.autoRepeatedCode = null;

    this.#edges.pushChar(this.newChar);
    this.newChar = "";

    this.#wasActive = active !== 0;
  }

  publish(
    reader: InputReader
  ): void {
    const edges = this.#edges.take(reader);
    if (edges.empty && !this.#publishedEdges) {
      return;
    }

    for (const keyState of this.buttons.values()) {
      keyState.wasJustPressed = edges.pressed.has(keyState.code);
      keyState.wasJustAutoRepeated = edges.autoRepeated.has(keyState.code);
      keyState.wasJustReleased = edges.released.has(keyState.code);
    }
    this.char = edges.char;
    this.#publishedEdges = !edges.empty;
  }
}

export {
  KEY_CODES,
  type KeyCode,
  type ExtendedKeyCode
} from "./code.ts";
export * from "./errors/index.ts";
export * from "./KeyBindingMap.ts";
export * from "./KeyBindings.ts";
export * from "./KeyChord.ts";
export * from "./layout.ts";
