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

function makeFakeVoxelRenderer(
  image: object = {}
): { vr: VoxelRenderer; dirtyReasons: string[]; } {
  const dirtyReasons: string[] = [];
  const tilesetManager = {
    getSourceTexture: () => {
      return { image };
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

function makeSizingManager(
  maxTextureSize: number
): PixelArtCanvas & { assigned: HTMLImageElement | null; } {
  const fakeCanvas = { toDataURL: () => "data:image/png;base64," } as unknown as HTMLCanvasElement;

  return {
    maxTextureSize,
    assigned: null,
    textureCanvas: () => fakeCanvas,
    hasTransparency: () => false,
    set texture(source: HTMLImageElement) {
      this.assigned = source;
    }
  } as unknown as PixelArtCanvas & { assigned: HTMLImageElement | null; };
}

function makeImage(
  width: number,
  height: number
): HTMLImageElement {
  return { naturalWidth: width, naturalHeight: height } as unknown as HTMLImageElement;
}

/**
 * Runs `fn` with console.error captured, returning everything it logged.
 */
function captureErrors(
  fn: () => void
): string[] {
  const logged: string[] = [];
  const original = console.error;
  console.error = (message: string) => {
    logged.push(message);
  };
  try {
    fn();
  }
  finally {
    console.error = original;
  }

  return logged;
}

describe("TextureEditorBridge / oversized textures", () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage; }).localStorage = {
      getItem: () => null,
      setItem: () => void 0
    } as unknown as Storage;
  });

  it("loads a source image that fits within the canvas limit", () => {
    const { vr } = makeFakeVoxelRenderer(makeImage(1024, 512));
    const manager = makeSizingManager(2048);

    const bridge = new TextureEditorBridge();
    bridge.attach(manager);

    const logged = captureErrors(() => bridge.loadTileset(vr, "atlas"));

    assert.deepEqual(logged, []);
    assert.equal(manager.assigned!.naturalWidth, 1024);
  });

  it("refuses a source image wider than the limit instead of throwing", () => {
    const { vr } = makeFakeVoxelRenderer(makeImage(1024, 512));
    const manager = makeSizingManager(512);

    const bridge = new TextureEditorBridge();
    bridge.attach(manager);

    const logged = captureErrors(() => bridge.loadTileset(vr, "atlas"));

    assert.equal(manager.assigned, null);
    assert.equal(logged.length, 1);
    assert.match(logged[0], /tileset source image.*1024x512.*512px per side/);
  });

  it("refuses an oversized cached edit without pushing it back to the tileset", () => {
    const { vr } = makeFakeVoxelRenderer(makeImage(64, 64));
    const manager = makeSizingManager(512);
    (globalThis as { localStorage?: Storage; }).localStorage = {
      getItem: () => "data:image/png;base64,cached",
      setItem: () => void 0
    } as unknown as Storage;

    let synced = 0;
    class FakeImage {
      naturalWidth = 4096;
      naturalHeight = 4096;
      onload: (() => void) | null = null;
      set src(_value: string) {
        this.onload?.();
      }
    }
    (globalThis as { Image?: unknown; }).Image = FakeImage;

    const bridge = new TextureEditorBridge();
    bridge.attach(manager);
    const original = bridge.syncToThree.bind(bridge);
    bridge.syncToThree = () => {
      synced++;
      original();
    };

    const logged = captureErrors(() => bridge.loadTileset(vr, "atlas"));

    assert.equal(manager.assigned, null);
    assert.equal(synced, 0);
    assert.match(logged[0], /locally cached edit.*4096x4096/);
  });
});
