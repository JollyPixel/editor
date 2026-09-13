// Import Third-party Dependencies
import {
  expect,
  test
} from "tstyche";

// Import Internal Dependencies
import {
  InputActionQuery,
  type KeyCode
} from "../src/index.ts";

declare const key: KeyCode | "ANY" | "NONE";

test("value excludes the ANY and NONE sentinels", () => {
  expect(new InputActionQuery(key).value).type.toBe<KeyCode | null>();
  expect(new InputActionQuery("ANY").value).type.toBe<null>();
  expect(new InputActionQuery<string>("KeyA").value).type.toBe<string | null>();
});

test("the value handler receives the action without sentinels", () => {
  new InputActionQuery(key).match({
    any: () => true,
    none: () => false,
    value: (action) => {
      expect(action).type.toBe<KeyCode>();

      return true;
    }
  });
});

test("an explicit action type restricts the constructor", () => {
  expect(InputActionQuery<KeyCode>).type.toBeConstructableWith("ANY");
  expect(InputActionQuery<KeyCode>).type.not.toBeConstructableWith("Jump");
});

test("match() requires every handler", () => {
  const query = new InputActionQuery(key);

  expect(query.match).type.not.toBeCallableWith({
    any: () => true,
    value: () => true
  });
});
