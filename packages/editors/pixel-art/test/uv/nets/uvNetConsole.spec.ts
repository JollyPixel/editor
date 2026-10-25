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
import { UvNetTestDocument } from "../../fixtures/uvNetDocument.ts";

describe("uvNetConsole", () => {
  test("picks the open texture's default net by id and rejects an unknown one", async() => {
    const commands = new CommandConsole();
    const uvNets = new UvNetLibrary();
    const texture = new UvNetTestDocument();
    uvNets.document = texture;
    uvNetConsole(commands, { uvNets });

    await commands.submit("/pixelart.nets.default cross");
    await commands.submit("/pixelart.nets.default nope");
    await commands.submit("/pixelart.nets.list");

    assert.strictEqual(texture.uvNets.defaultId, "cross");
    assert.deepStrictEqual(
      commands.scrollback.slice(-2).map((entry) => entry.text),
      ["packed  Packed  (locked)", "cross  Cross  (default, locked)"]
    );
  });

  test("refuses to pick a default net while no texture is open", async() => {
    const commands = new CommandConsole();
    const uvNets = new UvNetLibrary();
    uvNetConsole(commands, { uvNets });

    await commands.submit("/pixelart.nets.default cross");

    assert.strictEqual(uvNets.defaultId, "packed");
    assert.strictEqual(commands.scrollback.at(-1)?.text, "No texture is open");
  });
});
