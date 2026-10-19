// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type { UVNet } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UvNetController } from "../../../src/uv/nets/UvNetController.ts";
import { UvNetLibrary } from "../../../src/uv/nets/UvNetLibrary.ts";
import { TestHost } from "../../fixtures/host.ts";

describe("UvNetController", () => {
  test("hands every canvas the default net of the current library as it changes", () => {
    const adopted: UVNet[] = [];
    const controller = new UvNetController(new TestHost(), {
      canvas: () => null,
      dialog: () => {
        throw new Error("no dialog in unit tests");
      },
      adopt: (net) => adopted.push(net)
    });
    const first = controller.library;
    controller.hostConnected();
    const second = new UvNetLibrary();
    const strip = second.create("Strip", [["front", "back"]]);

    controller.library = second;
    second.defaultId = strip.id;
    first.defaultId = "cross";

    assert.deepStrictEqual(adopted, [
      first.get("packed")!.net,
      second.get("packed")!.net,
      strip.net
    ]);
  });
});
