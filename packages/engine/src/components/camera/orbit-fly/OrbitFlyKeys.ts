// Import Third-party Dependencies
import {
  AliasedKeyInput,
  MODIFIER_KEY_CODES,
  isKeyCode,
  type KeyCode
} from "@jolly-pixel/controls";

// CONSTANTS
export const ORBIT_FLY_ACTIONS = [
  "forward",
  "back",
  "left",
  "right",
  "up",
  "down",
  "lookUp",
  "lookDown",
  "lookLeft",
  "lookRight"
] as const;

export type OrbitFlyAction = typeof ORBIT_FLY_ACTIONS[number];

export type OrbitFlyKeyCodes = Readonly<
  Record<OrbitFlyAction, readonly KeyCode[]>
>;

export const ORBIT_FLY_DEFAULT_KEYS: OrbitFlyKeyCodes = Object.freeze({
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  up: ["Space"],
  down: MODIFIER_KEY_CODES.Shift,
  lookUp: ["KeyI"],
  lookDown: ["KeyK"],
  lookLeft: ["KeyJ"],
  lookRight: ["KeyL"]
});

export class OrbitFlyKeys {
  static readonly default = new OrbitFlyKeys();

  static from(
    codes: Readonly<Record<OrbitFlyAction, readonly string[]>>
  ): OrbitFlyKeys {
    const parsed: Partial<Record<OrbitFlyAction, readonly KeyCode[]>> = {};
    for (const action of ORBIT_FLY_ACTIONS) {
      parsed[action] = codes[action].filter(isKeyCode);
    }

    return new OrbitFlyKeys(parsed);
  }

  readonly codes: OrbitFlyKeyCodes;

  readonly #held: Readonly<Record<OrbitFlyAction, AliasedKeyInput>>;

  constructor(
    codes: Partial<OrbitFlyKeyCodes> = {}
  ) {
    const resolved = {} as Record<OrbitFlyAction, readonly KeyCode[]>;
    const held = {} as Record<OrbitFlyAction, AliasedKeyInput>;
    for (const action of ORBIT_FLY_ACTIONS) {
      const actionCodes = Object.freeze([
        ...new Set(codes[action] ?? ORBIT_FLY_DEFAULT_KEYS[action])
      ]);
      resolved[action] = actionCodes;
      held[action] = new AliasedKeyInput(actionCodes);
    }

    this.codes = Object.freeze(resolved);
    this.#held = held;
  }

  held(
    action: OrbitFlyAction
  ): AliasedKeyInput {
    return this.#held[action];
  }
}
