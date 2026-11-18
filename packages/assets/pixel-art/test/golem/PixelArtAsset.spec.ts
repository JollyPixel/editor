// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ColorParseError } from "@jolly-pixel/color";
import {
  TestStudio,
  type HostedAsset
} from "@jolly-pixel/golem.kit/testing";

// Import Internal Dependencies
import {
  pixelArtAssetKind,
  type PixelArtState
} from "#src/asset/pixelArtAssetKind.ts";
import { PIXEL_CURSOR_PRESENCE_KEY } from "#src/network/presence/PixelCursorSync.ts";
import {
  GOLEM_KINDS,
  type PixelArtAsset
} from "#src/golem/index.ts";

interface OpenedTexture {
  texture: PixelArtAsset;
  hosted: HostedAsset<PixelArtState>;
}

async function openTexture(): Promise<OpenedTexture> {
  const studio = new TestStudio({ kinds: GOLEM_KINDS });
  const hosted = studio.host(
    "textures/hero.pixelart",
    pixelArtAssetKind({ defaultSize: { x: 8, y: 8 } })
  );

  return {
    hosted,
    texture: await studio.open(hosted.id, "pixelart")
  };
}

describe("PixelArtAsset", () => {
  test("paints pixels the studio keeps, with the golem's cursor", async() => {
    const { texture, hosted } = await openTexture();

    assert.equal(
      await texture.pixels.fillRect({ x: 0, y: 0, width: 2, height: 2, color: "#ff0000" }),
      4
    );
    await texture.pixels.paintPixels({ pixels: [{ x: 3, y: 0, color: "#00ff0080" }] });
    await texture.settled();

    const { buffer } = hosted.state.document;
    assert.deepEqual(buffer.samplePixel(1, 1), [255, 0, 0, 255]);
    assert.deepEqual(buffer.samplePixel(3, 0), [0, 255, 0, 128]);
    assert.deepEqual(hosted.room.presence[PIXEL_CURSOR_PRESENCE_KEY], { x: 3, y: 0 });
    const [[red, untouched, green]] = texture.pixels.readPixels({ x: 1, y: 0, width: 3, height: 1 }).rows;
    assert.deepEqual([red, green], ["#ff0000ff", "#00ff0080"]);
    assert.deepEqual(
      untouched.match(/[0-9a-f]{2}/g)?.map((channel) => Number.parseInt(channel, 16)),
      [...buffer.samplePixel(2, 0)]
    );
  });

  test("replaces the palette, and refuses pixels outside the texture", async() => {
    const { texture, hosted } = await openTexture();
    const { size } = texture.read();

    await texture.pixels.replacePalette({ colors: ["#000000", "#ffcc00"] });
    await texture.settled();

    assert.deepEqual(texture.read().palette, ["#000000ff", "#ffcc00ff"]);
    const sent = hosted.room.sent.length;
    await assert.rejects(
      texture.pixels.paintPixels({ pixels: [{ x: size.x, y: 0, color: "#ffffff" }] }),
      RangeError
    );
    await assert.rejects(
      texture.pixels.fillRect({ x: 0, y: 0, width: 1, height: 1, color: "#zz0000" }),
      ColorParseError
    );
    assert.equal(hosted.room.sent.length, sent);
  });
});
