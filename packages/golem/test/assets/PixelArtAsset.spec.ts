// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ColorParseError } from "@jolly-pixel/color";
import {
  PIXEL_CURSOR_PRESENCE_KEY,
  pixelArtDocumentKind
} from "@jolly-pixel/asset.pixel-art/client";

// Import Internal Dependencies
import type { PixelArtAsset } from "#src/assets/pixelArt/PixelArtAsset.ts";
import { Golem } from "#src/peer/Golem.ts";
import { AssetPeer } from "../helpers/AssetPeer.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

async function createTexture(
  golem: Golem
): Promise<PixelArtAsset> {
  const assetId = await golem.catalog.create("textures/hero.pixelart", null);

  return golem.open(assetId, "pixelart");
}

describe("PixelArtAsset", { timeout: 10_000 }, () => {
  test("paints pixels a watching person sees, with the golem's cursor", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const texture = await createTexture(golem);
    using person = await AssetPeer.join({
      socketUrl: backend.socketUrl,
      credential: (await createAgentToken(backend, bob, "Watcher")).value,
      assetId: texture.id,
      documentKind: pixelArtDocumentKind()
    });

    assert.equal(await texture.pixels.fillRect({ x: 0, y: 0, width: 2, height: 2 }, "#ff0000"), 4);
    await texture.pixels.paintPixels([{ x: 3, y: 0, color: "#00ff0080" }]);
    await texture.settled();
    const { buffer } = person.synced.document;
    await person.until(() => buffer.samplePixel(3, 0)[3] === 128 &&
      person.peerNamed("Builder")?.presence[PIXEL_CURSOR_PRESENCE_KEY] !== undefined);

    assert.deepEqual(buffer.samplePixel(1, 1), [255, 0, 0, 255]);
    assert.deepEqual(
      person.peerNamed("Builder")?.presence[PIXEL_CURSOR_PRESENCE_KEY],
      { x: 3, y: 0 }
    );
    const [[red, untouched, green]] = texture.pixels.readPixels({ x: 1, y: 0, width: 3, height: 1 }).rows;
    assert.deepEqual([red, green], ["#ff0000ff", "#00ff0080"]);
    assert.deepEqual(
      untouched.match(/[0-9a-f]{2}/g)?.map((channel) => Number.parseInt(channel, 16)),
      buffer.samplePixel(2, 0)
    );
  });

  test("replaces the palette, and refuses pixels outside the texture", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    using golem = await Golem.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const texture = await createTexture(golem);
    const { size } = texture.read();

    await texture.pixels.replacePalette(["#000000", "#ffcc00"]);
    await texture.settled();

    assert.deepEqual(texture.read().palette, ["#000000ff", "#ffcc00ff"]);
    await assert.rejects(
      texture.pixels.paintPixels([{ x: size.x, y: 0, color: "#ffffff" }]),
      RangeError
    );
    await assert.rejects(
      texture.pixels.fillRect({ x: 0, y: 0, width: 1, height: 1 }, "#zz0000"),
      ColorParseError
    );
  });
});
