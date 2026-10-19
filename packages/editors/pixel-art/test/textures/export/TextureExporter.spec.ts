// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { render } from "lit";
import { decodePng } from "@jolly-pixel/image";
import {
  IslandMap,
  NormalMap,
  NormalMapConfig,
  type PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TextureExporter } from "../../../src/textures/export/TextureExporter.ts";
import { TestHost } from "../../fixtures/host.ts";
import { FakeFrames } from "../../fixtures/frames.ts";

// CONSTANTS
const kSize = {
  x: 2,
  y: 1
};
const kAlbedo = new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 255, 128]);

function makeCanvas(
  hasNormalMap: boolean
): PixelArtCanvas {
  const flat = new Uint8ClampedArray(kSize.x * kSize.y * 4).fill(255);
  const normals = new NormalMap({
    size: () => kSize,
    pixels: () => flat,
    islands: () => IslandMap.fromFaces(kSize, []),
    config: () => NormalMapConfig.create(),
    connect: () => () => undefined
  });
  const texture = {
    width: kSize.x,
    height: kSize.y,
    getContext: () => {
      return {
        getImageData: () => {
          return { data: kAlbedo };
        }
      };
    }
  };

  return {
    textureCanvas: () => texture,
    document: {
      normalMap: hasNormalMap ? {} : null,
      normals
    }
  } as unknown as PixelArtCanvas;
}

function setup(
  options: { hasNormalMap: boolean; normalMap: boolean; }
) {
  const canvas = makeCanvas(options.hasNormalMap);

  return new TextureExporter(new TestHost(), {
    canvas: () => canvas,
    normalMap: () => options.normalMap
  });
}

function exportParts(
  exporter: TextureExporter
): (string | null)[] {
  const container = document.createElement("div");
  render(exporter.render(), container);

  return [...container.querySelectorAll("button")]
    .map((button) => button.getAttribute("part"));
}

describe("TextureExporter", () => {
  test("captures the albedo pixels as texture.png", async() => {
    const exporter = setup({
      hasNormalMap: false,
      normalMap: true
    });

    const file = await exporter.capture("albedo");
    assert.ok(file);
    const image = await decodePng(file.bytes);

    assert.equal(file.name, "texture.png");
    assert.deepEqual([image.width, image.height], [2, 1]);
    assert.deepEqual(Array.from(image.data), Array.from(kAlbedo));
  });

  test("captures the DirectX normal map with its green channel inverted", async(t) => {
    new FakeFrames(t);
    const exporter = setup({
      hasNormalMap: true,
      normalMap: true
    });

    const file = await exporter.capture("normal-directx");
    assert.ok(file);
    const image = await decodePng(file.bytes);

    assert.equal(file.name, "texture.normal.png");
    assert.deepEqual(
      Array.from(image.data),
      [128, 127, 255, 255, 128, 127, 255, 255]
    );
  });

  test("offers normal map formats only when the panel enables them and the document has one", async() => {
    const disabled = setup({
      hasNormalMap: true,
      normalMap: false
    });
    const missing = setup({
      hasNormalMap: false,
      normalMap: true
    });
    const enabled = setup({
      hasNormalMap: true,
      normalMap: true
    });

    assert.deepEqual(exportParts(disabled), ["export-button"]);
    assert.deepEqual(exportParts(missing), ["export-button"]);
    assert.equal(await disabled.capture("normal-opengl"), null);
    assert.deepEqual(exportParts(enabled), [
      "export-button",
      "export-albedo-button",
      "export-normal-opengl",
      "export-normal-directx"
    ]);
  });
});
