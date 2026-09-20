// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { exposeDebugHandle } from "#src/editor/exposeDebugHandle.ts";

describe("exposeDebugHandle", () => {
  test("sets the handle on globalThis and removes it", () => {
    const handle = { name: "editor" };
    const remove = exposeDebugHandle("hostTestHandle", handle);

    assert.equal(Reflect.get(globalThis, "hostTestHandle"), handle);
    remove();
    assert.equal(Reflect.has(globalThis, "hostTestHandle"), false);
  });
});
