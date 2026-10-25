// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import type {
  PixelArtCanvas,
  UVNet
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UvNetController } from "../../../src/uv/nets/UvNetController.ts";
import { UvNetLibrary } from "../../../src/uv/nets/UvNetLibrary.ts";
import { TestHost } from "../../fixtures/host.ts";
import { UvNetTestDocument } from "../../fixtures/uvNetDocument.ts";

// CONSTANTS
const kStripRows = [[["front"], ["back"]]];

function showTexture(
  document: UvNetTestDocument
): PixelArtCanvas {
  return { document } as unknown as PixelArtCanvas;
}

describe("UvNetController", () => {
  test("hands canvases the active texture's default net as the texture, default or library changes", () => {
    const first = new UvNetTestDocument();
    first.saveUvNet({ id: "strip", name: "Strip", rows: kStripRows });
    first.changeDefaultUvNet("strip");
    const second = new UvNetTestDocument();
    let active = first;
    const adopted: UVNet[] = [];
    const controller = new UvNetController(new TestHost(), {
      canvas: () => showTexture(active),
      dialog: () => {
        throw new Error("no dialog in unit tests");
      },
      adopt: (net) => adopted.push(net)
    });
    const cross = controller.library.get("cross")!.net.rows;

    controller.hostConnected();
    controller.followActiveTexture();
    active = second;
    controller.followActiveTexture();
    second.changeDefaultUvNet("cross");
    controller.library = new UvNetLibrary();

    assert.deepStrictEqual(
      adopted.map((net) => net.rows),
      [null, kStripRows, null, cross, cross]
    );
    assert.strictEqual(controller.library.document, second);
  });
});
