// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { CommandConsole } from "@jolly-pixel/console";

// Import Internal Dependencies
import { UvNetLibrary } from "../../../src/uv/nets/UvNetLibrary.ts";
import { uvNetConsole } from "../../../src/uv/nets/uvNetConsole.ts";

describe("uvNetConsole", () => {
  test("picks the default net by id and rejects an unknown one", async() => {
    const commands = new CommandConsole();
    const uvNets = new UvNetLibrary();
    uvNetConsole(commands, { uvNets });

    await commands.submit("/pixelart.nets.default cross");
    await commands.submit("/pixelart.nets.default nope");
    await commands.submit("/pixelart.nets.list");

    assert.strictEqual(uvNets.defaultId, "cross");
    assert.deepStrictEqual(
      commands.scrollback.slice(-2).map((entry) => entry.text),
      ["packed  Packed  (locked)", "cross  Cross  (default, locked)"]
    );
  });
});
