// Import Node.js Dependencies
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockRegistry,
  Face,
  type VoxelRenderer,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";
import type { PixelArtCanvas, SelectionRect } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TextureEditorBridge } from "../../src/lib/TextureEditorBridge.ts";

function makeBlock(
  id: number,
  options: {
    transparent?: boolean;
    defaultTexture?: BlockDefinition["defaultTexture"];
    faceTextures?: BlockDefinition["faceTextures"];
  } = {}
): BlockDefinition {
  return {
    id,
    name: `Block${id}`,
    shapeId: "cube",
    collidable: true,
    transparent: options.transparent,
    faceTextures: options.faceTextures ?? {},
    defaultTexture: options.defaultTexture
  };
}

function makeFakeVoxelRenderer(): { vr: VoxelRenderer; dirtyReasons: string[]; } {
  const dirtyReasons: string[] = [];
  const tilesetManager = {
    getSourceTexture: () => {
      return { image: {} };
    },
    updateSourceImage: () => void 0,
    getDefinitions: () => [{ id: "atlas", src: "", tileSize: 16, cols: 4, rows: 4 }]
  };
  const fake = {
    engine: {
      blockRegistry: new BlockRegistry(),
      tilesetManager,
      markAllChunksDirty: (reason: string) => {
        dirtyReasons.push(reason);
      }
    }
  };

  return { vr: fake as unknown as VoxelRenderer, dirtyReasons };
}

function makeFakeManager(
  hasTransparency: (rect: SelectionRect) => boolean
): PixelArtCanvas {
  const fakeCanvas = { toDataURL: () => "data:image/png;base64," } as unknown as HTMLCanvasElement;

  return {
    textureCanvas: () => fakeCanvas,
    hasTransparency
  } as unknown as PixelArtCanvas;
}

describe("TextureEditorBridge / transparency auto-sync", () => {
  beforeEach(() => {
    // syncToThree() also caches to localStorage, which isn't a Node global.
    (globalThis as { localStorage?: Storage; }).localStorage = {
      getItem: () => null,
      setItem: () => void 0
    } as unknown as Storage;
  });

  it("flips transparent false -> true once its tile gains alpha, and leaves an unaffected block alone", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      transparent: false,
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));
    vr.engine.blockRegistry.register(makeBlock(2, {
      transparent: false,
      defaultTexture: { tilesetId: "atlas", col: 1, row: 0 }
    }));

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager((rect) => rect.x === 0));
    bridge.loadTileset(vr, "atlas");

    bridge.syncToThree();

    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, true);
    assert.equal(vr.engine.blockRegistry.get(2)!.transparent, false);
    assert.deepEqual(dirtyReasons, ["BlockLibrary update"]);
  });

  it("is a no-op once the flag already matches the tile's actual transparency", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      transparent: false,
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager(() => true));
    bridge.loadTileset(vr, "atlas");

    bridge.syncToThree();
    bridge.syncToThree();

    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, true);
    assert.deepEqual(dirtyReasons, ["BlockLibrary update"]);
  });

  it("flips transparent true -> false once its tile loses all alpha", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      transparent: true,
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager(() => false));
    bridge.loadTileset(vr, "atlas");

    bridge.syncToThree();

    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, false);
    assert.deepEqual(dirtyReasons, ["BlockLibrary update"]);
  });

  it("detects a change reached only through a faceTextures entry, not defaultTexture", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      transparent: false,
      defaultTexture: { tilesetId: "other", col: 0, row: 0 },
      faceTextures: { [Face.PosY]: { tilesetId: "atlas", col: 2, row: 0 } }
    }));

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager((rect) => rect.x === 32));
    bridge.loadTileset(vr, "atlas");

    bridge.syncToThree();

    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, true);
    assert.deepEqual(dirtyReasons, ["BlockLibrary update"]);
  });
});
