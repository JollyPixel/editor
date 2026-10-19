// Import Internal Dependencies
import type { InputDevices } from "../../types.ts";
import {
  mapKeyToExtendedKey,
  type KeyCode,
  type ExtendedKeyCode
} from "../../devices/keyboard/code.ts";
import type { InputCondition } from "./InputCondition.ts";
import type { CombinedInputState } from "../types.ts";

export type AliasedKeys =
  | readonly ExtendedKeyCode[]
  | (() => readonly ExtendedKeyCode[]);

interface AliasedKeyFamily {
  source: AliasedKeys;
  keys: readonly KeyCode[] | null;
  members: Map<CombinedInputState, AliasedKeyInput>;
}

export class AliasedKeyInput implements InputCondition {
  readonly state: CombinedInputState;
  #family: AliasedKeyFamily;

  constructor(
    keys: AliasedKeys,
    state: CombinedInputState = "down"
  ) {
    this.state = state;
    this.#family = {
      source: typeof keys === "function"
        ? keys
        : [...keys],
      keys: null,
      members: new Map([
        [state, this]
      ])
    };
  }

  get keys(): KeyCode[] {
    return [...this.#resolveKeys()];
  }

  get down(): AliasedKeyInput {
    return this.#member("down");
  }

  get pressed(): AliasedKeyInput {
    return this.#member("pressed");
  }

  get released(): AliasedKeyInput {
    return this.#member("released");
  }

  evaluate(
    input: InputDevices
  ): boolean {
    const keys = this.#resolveKeys();
    const { keyboard } = input;

    if (this.state === "down") {
      return keys.some((key) => keyboard.isDown(key));
    }

    let isDown = false;
    let wasDown = false;
    let pressed = false;
    let released = false;
    for (const key of keys) {
      isDown ||= keyboard.isDown(key);
      wasDown ||= keyboard.wasDownLastUpdate(key);
      pressed ||= keyboard.wasJustPressed(key);
      released ||= keyboard.wasJustReleased(key);
    }

    switch (this.state) {
      case "pressed":
        return pressed && !wasDown;
      case "released":
        return released && !isDown;
      default:
        return false;
    }
  }

  reset(): void {
    return;
  }

  #resolveKeys(): readonly KeyCode[] {
    const family = this.#family;
    if (family.keys === null) {
      const keys = typeof family.source === "function" ?
        family.source() :
        family.source;
      family.keys = [
        ...new Set(keys.map(mapKeyToExtendedKey))
      ];
    }

    return family.keys;
  }

  #member(
    state: CombinedInputState
  ): AliasedKeyInput {
    const family = this.#family;
    let member = family.members.get(state);
    if (member === undefined) {
      member = new AliasedKeyInput([], state);
      member.#family = family;
      family.members.set(state, member);
    }

    return member;
  }
}
