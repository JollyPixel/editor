// Import Node.js Dependencies
import { describe, test } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import * as THREE from "three";
import { Emitter } from "@openally/emitt";
import {
  IslandMap,
  NormalMap,
  NormalMapConfig,
  type IslandFace,
  type PixelDocumentEvent,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import {
  BlockShapeRegistry,
  resolveBlockDefinition
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  BlocksetAtlasBridge,
  type BlocksetAtlasBridgeOptions
} from "../../../src/features/blocksets/BlocksetAtlasBridge.ts";
import { FakeFrames } from "../../helpers/frames.ts";

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
  islandFaces: (() => Iterable<IslandFace>) | null = null;
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
      islands: () => IslandMap.fromFaces(kSize, this.islandFaces?.() ?? []),
      config: () => this.normalMap,
      connect: () => () => undefined
    });
  }

  size(): typeof kSize {
    return kSize;
  }

  useIslandFaces(
    faces: () => Iterable<IslandFace>
  ): () => void {
    this.islandFaces = faces;

    return () => {
      this.islandFaces = null;
    };
  }

  invalidateIslands(): void {
    this.normals.invalidateIslands();
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

function setup() {
  const queue: Array<() => void> = [];
  const counts = {
    images: 0,
    frames: 0,
    alphaSyncs: 0
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
    tileSize: 16,
    blocks: [
      resolveBlockDefinition({
        id: 1,
        name: "stone",
        shapeId: "cube",
        defaultTexture: { col: 1, row: 0 }
      })
    ]
  });
  const options = {
    view: {
      shapes: BlockShapeRegistry.createDefault(),
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
    pixels,
    blockset,
    definition: {
      id: "tiles",
      tileSize: 16,
      cols: 2,
      rows: 2
    },
    mapDocument: {
      ready: true,
      subscribe: () => () => undefined
    },
    blocks: {
      defineBlock: () => undefined,
      syncAlphaModes: () => {
        counts.alphaSyncs++;
      }
    },
    scheduler: (callback: () => void) => {
      queue.push(callback);
    }
  } as unknown as BlocksetAtlasBridgeOptions;
  const bridge = new BlocksetAtlasBridge(options);

  return {
    bridge,
    pixels,
    atlas,
    loads,
    queue,
    counts,
    toggleNormalMap(config: NormalMapConfig | null): void {
      pixels.toggleNormalMap(config);
    },
    runQueue(): void {
      for (const callback of queue.splice(0)) {
        callback();
      }
    }
  };
}

describe("BlocksetAtlasBridge", () => {
  test("syncs on construction and schedules nothing while idle", () => {
    const { queue, counts } = setup();

    assert.equal(counts.images, 1);
    assert.equal(counts.frames, 1);
    assert.equal(queue.length, 0);
  });

  test("a pixel change schedules one flush, then the alpha sync", () => {
    const { pixels, queue, counts, runQueue } = setup();

    pixels.emit("changed", { bounds: kRect });
    pixels.emit("changed", { bounds: kRect });
    assert.equal(queue.length, 1);

    const alphaSyncs = counts.alphaSyncs;
    runQueue();
    assert.equal(counts.images, 2);
    assert.equal(counts.frames, 2);
    assert.equal(queue.length, 1);

    runQueue();
    assert.equal(counts.alphaSyncs, alphaSyncs + 1);
    assert.equal(queue.length, 0);
  });

  test("builds the pixel islands from the blockset blocks until destroyed", () => {
    const { bridge, pixels } = setup();

    assert.ok(pixels.islandFaces);
    assert.deepEqual(
      [...new Set([...pixels.islandFaces()].map(({ regionId }) => regionId))],
      ["block-1"]
    );

    bridge.destroy();

    assert.equal(pixels.islandFaces, null);
  });

  test("attaches the pixels normal map while they have settings", (t) => {
    new FakeFrames(t);
    const { pixels, atlas, loads, queue, runQueue, toggleNormalMap } = setup();

    toggleNormalMap(NormalMapConfig.create());
    assert.equal(queue.length, 1);
    runQueue();

    assert.equal(loads.length, 1);
    assert.ok(loads[0] instanceof THREE.DataTexture);
    assert.equal(loads[0].colorSpace, THREE.NoColorSpace);
    assert.equal(loads[0].image.data, pixels.normals.pixels);
    assert.equal(atlas.normal, loads[0]);

    toggleNormalMap(null);
    runQueue();

    assert.deepEqual(loads.slice(1), [null]);
    assert.equal(atlas.normal, null);
  });

  test("reloads nothing when a normal map setting changes", (t) => {
    new FakeFrames(t);
    const { loads, queue, runQueue, toggleNormalMap } = setup();
    toggleNormalMap(NormalMapConfig.create());
    runQueue();

    toggleNormalMap(NormalMapConfig.create().withDefaults({ strength: 4 }));

    assert.equal(queue.length, 0);
    assert.equal(loads.length, 1);
  });

  test("requests a frame when the normal map regenerates", (t) => {
    const frames = new FakeFrames(t);
    const { pixels, counts, runQueue, toggleNormalMap } = setup();
    toggleNormalMap(NormalMapConfig.create());
    runQueue();
    const before = counts.frames;

    pixels.normals.invalidate(kRect);
    frames.run();

    assert.equal(counts.frames, before + 1);
  });

  test("a destroyed bridge stops scheduling", () => {
    const { bridge, pixels, queue } = setup();

    bridge.destroy();
    pixels.emit("changed", { bounds: kRect });

    assert.equal(queue.length, 0);
  });
});
