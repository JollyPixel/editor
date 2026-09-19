// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { DevOptions } from "#src/dev/DevOptions.ts";
import { exposeDebugHandle } from "#src/dev/exposeDebugHandle.ts";

describe("DevOptions", () => {
  test("maps camelCase keys to kebab-case query parameters", () => {
    const options = new DevOptions({
      offline: DevOptions.flag(),
      maxFps: DevOptions.number(),
      samples: DevOptions.number(4),
      mode: DevOptions.string()
    }).read("?offline&max-fps=10&samples=oops");

    assert.deepEqual(options, {
      offline: true,
      maxFps: 10,
      samples: 4,
      mode: undefined
    });
  });

  test("absent flags are false", () => {
    assert.deepEqual(
      new DevOptions({ offline: DevOptions.flag() }).read(""),
      { offline: false }
    );
  });
});

describe("exposeDebugHandle", () => {
  test("sets the handle on globalThis and removes it", () => {
    const handle = { name: "editor" };
    const remove = exposeDebugHandle("hostTestHandle", handle);

    assert.equal(Reflect.get(globalThis, "hostTestHandle"), handle);
    remove();
    assert.equal(Reflect.has(globalThis, "hostTestHandle"), false);
  });
});
