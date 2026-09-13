// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  AliasedKeyInput,
  type CombinedInputState
} from "../../../src/index.ts";

test("accepts key codes, shorthands or a key resolver", () => {
  expect(AliasedKeyInput).type.toBeConstructableWith(["ShiftLeft", "ShiftRight"]);
  expect(AliasedKeyInput).type.toBeConstructableWith(["w", "ArrowUp"], "pressed");
  expect(AliasedKeyInput).type.toBeConstructableWith(() => ["MetaLeft"]);
});

test("rejects non key actions and unknown states", () => {
  expect(AliasedKeyInput).type.not.toBeConstructableWith(["left"]);
  expect(AliasedKeyInput).type.not.toBeConstructableWith(["ANY"]);
  expect(AliasedKeyInput).type.not.toBeConstructableWith(["KeyA"], "held");
});

test("exposes its state and sibling states", () => {
  const condition = new AliasedKeyInput(["KeyA"]);

  expect(condition.state).type.toBe<CombinedInputState>();
  expect(condition.released).type.toBe<AliasedKeyInput>();
});
