// Import Node.js Dependencies
import {
  describe,
  test,
  type TestContext
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { Emitter } from "@openally/emitt";
import {
  IslandMap,
  NormalMap,
  NormalMapConfig,
  type PixelDocument,
  type PixelDocumentEvent,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import type { BlocksetDocument } from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BlocksetAtlasBridge,
  type BlocksetAtlasBridgeOptions
} from "../../src/viewer/BlocksetAtlasBridge.ts";
import { BlocksetSurface } from "../../src/viewer/BlocksetSurface.ts";
import { FakeFrames } from "../helpers/frames.ts";

// CONSTANTS
const kRect: SelectionRect = {
  x: 0,
  y: 0,
  width: 4,
  height: 4
};
const kSize = {
  x: 32,
  y: 32
};

class FakeBlocksetPixels extends Emitter<PixelDocumentEvent> {
  normalMap: NormalMapConfig | null = null;
  readonly buffer = {
    canvas: () => {
      return {};
    }
  };
  readonly normals: NormalMap;
  readonly #pixels = new Uint8ClampedArray(kSize.x * kSize.y * 4);

  constructor() {
    super();
    this.normals = new NormalMap({
      size: () => kSize,
      pixels: () => this.#pixels,
      islands: () => IslandMap.fromFaces(kSize, []),
      config: () => this.normalMap,
      connect: () => () => undefined
    });
  }

  size(): typeof kSize {
    return kSize;
  }

  toggleNormalMap(
    config: NormalMapConfig | null
  ): void {
    this.normalMap = config;
    this.emit("normal-map-changed", {
      config,
      regionIds: null
    });
  }
}

function setup(
  t: TestContext
) {
  const frames = new FakeFrames(t);
  const counts = {
    images: 0,
    frames: 0
  };
  const loads: (THREE.Texture | null)[] = [];
  const atlas = {
    def: {
      tileSize: 16,
      cols: 2,
      rows: 2
    },
    normal: null as THREE.Texture | null,
    updateImage: () => {
      counts.images++;
    }
  };
  const pixels = new FakeBlocksetPixels();
  const blockset = Object.assign(new Emitter(), {
    tileSize: 16
  });
  const surface = new BlocksetSurface({
    pixels: pixels as unknown as PixelDocument,
    blockset: blockset as unknown as BlocksetDocument
  });
  const options = {
    view: {
      atlases: {
        get: () => atlas,
        requireLoadedAtlas: () => atlas
      },
      loadBlockset: (
        _definition: unknown,
        _texture: unknown,
        options: { normal?: THREE.Texture; }
      ) => {
        const normal = options.normal ?? null;
        loads.push(normal);
        atlas.normal = normal;
      },
      requestFrame: () => {
        counts.frames++;
      }
    },
    surface,
    definition: {
      id: "tiles",
      tileSize: 16,
      cols: 2,
      rows: 2
    }
  } as unknown as BlocksetAtlasBridgeOptions;
  const bridge = new BlocksetAtlasBridge(options);

  return {
    bridge,
    pixels,
    atlas,
    loads,
    frames,
    counts,
    toggleNormalMap(config: NormalMapConfig | null): void {
      pixels.toggleNormalMap(config);
    }
  };
}

describe("BlocksetAtlasBridge", () => {
  test("syncs on construction and schedules nothing while idle", (t) => {
    const { frames, counts } = setup(t);

    assert.equal(counts.images, 1);
    assert.equal(counts.frames, 1);
    assert.equal(frames.length, 0);
  });

  test("uploads a burst of pixel changes once on the next frame", (t) => {
    const { pixels, frames, counts } = setup(t);

    pixels.emit("changed", { bounds: kRect });
    pixels.emit("changed", { bounds: kRect });
    assert.equal(frames.length, 1);

    frames.run();
    assert.equal(counts.images, 2);
    assert.equal(counts.frames, 2);

    frames.run();
    assert.equal(counts.images, 2);
  });

  test("attaches the pixels normal map while they have settings", (t) => {
    const { pixels, atlas, loads, frames, toggleNormalMap } = setup(t);

    toggleNormalMap(NormalMapConfig.create());
    assert.equal(frames.length, 1);
    frames.run();

    assert.equal(loads.length, 1);
    assert.ok(loads[0] instanceof THREE.DataTexture);
    assert.equal(loads[0].colorSpace, THREE.NoColorSpace);
    assert.equal(loads[0].image.data, pixels.normals.pixels);
    assert.equal(atlas.normal, loads[0]);

    toggleNormalMap(null);
    frames.run();

    assert.deepEqual(loads.slice(1), [null]);
    assert.equal(atlas.normal, null);
  });

  test("reloads nothing when a normal map setting changes", (t) => {
    const { loads, frames, toggleNormalMap } = setup(t);
    toggleNormalMap(NormalMapConfig.create());
    frames.run();

    toggleNormalMap(NormalMapConfig.create().withDefaults({ strength: 4 }));

    assert.equal(frames.length, 0);
    assert.equal(loads.length, 1);
  });

  test("requests a frame when the normal map regenerates", (t) => {
    const { pixels, counts, frames, toggleNormalMap } = setup(t);
    toggleNormalMap(NormalMapConfig.create());
    frames.run();
    const before = counts.frames;

    pixels.normals.invalidate(kRect);
    frames.run();

    assert.equal(counts.frames, before + 1);
  });

  test("a destroyed bridge uploads nothing", (t) => {
    const { bridge, pixels, frames, counts } = setup(t);

    bridge.destroy();
    pixels.emit("changed", { bounds: kRect });
    frames.run();

    assert.equal(counts.images, 1);
  });
});
