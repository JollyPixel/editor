// Import Internal Dependencies
import type { Input } from "../../Input.class.ts";
import {
  mapKeyToExtendedKey,
  type KeyCode,
  type ExtendedKeyCode
} from "../../devices/keyboard/code.ts";
import {
  bindInputCondition,
  type InputCondition,
  type BoundInputCondition
} from "./InputCondition.ts";
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
      source: typeof keys === "function" ? keys : [...keys],
      keys: null,
      members: new Map([[state, this]])
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
    input: Input
  ): boolean {
    const keys = this.#resolveKeys();
    const { keyboard } = input;

    if (this.state === "down") {
      return keys.some((key) => keyboard.isDown(key));
    }

    let isDown = false;
    let wasDown = false;
    for (const key of keys) {
      const keyIsDown = keyboard.isDown(key);

      isDown ||= keyIsDown;
      wasDown ||= keyboard.wasJustReleased(key) ||
        (keyIsDown && !keyboard.wasJustPressed(key));
    }

    switch (this.state) {
      case "pressed":
        return isDown && !wasDown;
      case "released":
        return !isDown && wasDown;
      default:
        return false;
    }
  }

  reset(): void {
    return;
  }

  bind(
    input: Input
  ): BoundInputCondition {
    return bindInputCondition(this, input);
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
