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
} from "../../adapters/index.ts";
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
} from "./bindings/KeyBindings.ts";
import { TypedText } from "./TypedText.ts";
import {
  ControlBank,
  type ControlQuery
} from "../ControlBank.ts";
import { ReaderBuffer } from "../ReaderBuffer.ts";

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

const kEditableTargetGuard: KeyboardGuard = {
  blocks: isEditableTarget
};

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

  #guards = new Map<KeyboardGuard, (() => void) | null>();
  #suspensions = 0;
  #bindings = new KeyBindings();
  #keys = new ControlBank<string>();
  #text = new ReaderBuffer(() => new TypedText());

  constructor(
    options: KeyboardOptions = {}
  ) {
    super();
    const {
      documentAdapter = new BrowserDocumentAdapter(),
      preventControlKeys = true
    } = options;

    this.#documentAdapter = documentAdapter;
    this.#preventControlKeys = preventControlKeys;
    this.addGuard(kEditableTargetGuard);
  }

  get wasActive() {
    return this.#keys.active;
  }

  get char(): string {
    return this.#text.published.value;
  }

  get suspended(): boolean {
    return this.#suspensions > 0;
  }

  suspend(): () => void {
    this.#suspensions++;
    this.#releaseHeldKeys();

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
    this.#keys.releaseAll();
  };

  #isBlocked(
    event: KeyboardEvent
  ): boolean {
    if (this.suspended) {
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
    this.#keys.reset();
    this.#text.reset();
  }

  isDown(
    key: InputKeyboardAction
  ): boolean {
    return this.#keys.isDown(Keyboard.#keyQuery(key));
  }

  wasDownLastUpdate(
    key: ExtendedKeyCode
  ): boolean {
    return this.#keys.wasDownBefore(
      mapKeyToExtendedKey(key)
    );
  }

  wasJustPressed(
    key: InputKeyboardAction
  ): boolean {
    return this.#keys.wasPressed(
      Keyboard.#keyQuery(key)
    );
  }

  wasJustReleased(
    key: InputKeyboardAction
  ): boolean {
    return this.#keys.wasReleased(
      Keyboard.#keyQuery(key)
    );
  }

  wasJustAutoRepeated(
    key: ExtendedKeyCode
  ): boolean {
    return this.#keys.wasRepeated(
      mapKeyToExtendedKey(key)
    );
  }

  #onKeyDown = (event: KeyboardEvent) => {
    if (this.#isBlocked(event)) {
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

    if (!this.#keys.press(event.code)) {
      this.#keys.repeat(event.code);
    }
    this.emit("down", event);
    this.emit(event.code as KeyCode, event);
    this.#bindings.dispatch(event);
  };

  #onKeyPress = (event: KeyboardEvent) => {
    if (this.#isBlocked(event)) {
      return;
    }

    if (
      event.key.length === 1 &&
      event.key.charCodeAt(0) >= 32
    ) {
      this.#text.queued.append(event.key);
      this.emit("press", event);
    }
  };

  #onKeyUp = (event: KeyboardEvent) => {
    this.#keys.release(event.code);
    this.emit("up", event);
  };

  update() {
    this.sample();
    this.publish("step");
  }

  sample(): void {
    this.#keys.sample();
    this.#text.sample();
  }

  publish(
    reader: InputReader
  ): void {
    this.#keys.publish(reader);
    this.#text.publish(reader);
  }

  static #keyQuery(
    key: InputKeyboardAction
  ): ControlQuery<string> {
    return key === "ANY" || key === "NONE" ?
      key :
      mapKeyToExtendedKey(key);
  }
}

export {
  KEY_CODES,
  MODIFIER_KEY_CODES,
  isKeyCode,
  type KeyCode,
  type ExtendedKeyCode,
  type ModifierKey
} from "./code.ts";
export * from "./bindings/index.ts";
export * from "./chords/index.ts";
