// Import Node.js Dependencies
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  BlockRegistry,
  Face,
  type VoxelRenderer,
  type BlockDefinition
} from "@jolly-pixel/voxel.renderer";
import type {
  PixelArtCanvas,
  PixelNetworkCommand,
  PixelServerMessage,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import type * as network from "@jolly-pixel/network";

// Import Internal Dependencies
import { TextureEditorBridge } from "../../src/lib/TextureEditorBridge.ts";
import { applyBlockUpdate } from "../../src/lib/applyBlockUpdate.ts";

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
  image: object = {},
  definitions = [
    { id: "atlas", src: "", tileSize: 16, cols: 4, rows: 4 }
  ]
): {
  vr: VoxelRenderer;
  dirtyReasons: string[];
  updatedTilesets: string[];
} {
  const dirtyReasons: string[] = [];
  const updatedTilesets: string[] = [];
  const tilesetManager = {
    getSourceTexture: () => {
      return { image };
    },
    updateSourceImage: (_image: object, id: string) => {
      updatedTilesets.push(id);
    },
    getDefinitions: () => definitions
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

  return {
    vr: fake as unknown as VoxelRenderer,
    dirtyReasons,
    updatedTilesets
  };
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
    assert.deepEqual(dirtyReasons, ["block definitions updated"]);
    bridge.destroy();
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
    assert.deepEqual(dirtyReasons, ["block definitions updated"]);
    bridge.destroy();
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
    assert.deepEqual(dirtyReasons, ["block definitions updated"]);
    bridge.destroy();
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
    assert.deepEqual(dirtyReasons, ["block definitions updated"]);
    bridge.destroy();
  });
});

function makeSizingManager(
  maxTextureSize: number
): PixelArtCanvas & { assigned: HTMLImageElement | null; } {
  const fakeCanvas = { toDataURL: () => "data:image/png;base64," } as unknown as HTMLCanvasElement;
  let assigned: HTMLImageElement | null = null;

  const manager = {
    maxTextureSize,
    get assigned() {
      return assigned;
    },
    textureCanvas: () => fakeCanvas,
    hasTransparency: () => false,
    set texture(source: HTMLImageElement) {
      assigned = source;
    }
  };

  return manager as unknown as PixelArtCanvas & {
    assigned: HTMLImageElement | null;
  };
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
  it("loads a source image that fits within the canvas limit", () => {
    const { vr } = makeFakeVoxelRenderer(makeImage(1024, 512));
    const manager = makeSizingManager(2048);

    const bridge = new TextureEditorBridge();
    bridge.attach(manager);

    const logged = captureErrors(() => bridge.loadTileset(vr, "atlas"));

    assert.deepEqual(logged, []);
    assert.equal(manager.assigned!.naturalWidth, 1024);
    bridge.destroy();
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
    bridge.destroy();
  });
});

describe("TextureEditorBridge / room startup", () => {
  it("subscribes before joining the room", () => {
    const calls: string[] = [];
    const room = {
      on: () => calls.push("subscribe"),
      off: () => void 0,
      join: () => calls.push("join"),
      leave: () => void 0,
      send: () => void 0
    } as unknown as network.Room<PixelNetworkCommand, PixelServerMessage>;
    const bridge = new TextureEditorBridge();

    bridge.attach(makeFakeManager(() => false), room);

    assert.deepEqual(calls, ["subscribe", "join"]);
    bridge.destroy();
  });

  it("pushes a room snapshot back to the Three.js tileset", () => {
    let onMessage: ((message: unknown) => void) | undefined;
    const room = {
      clientId: "local",
      on: (_event: string, listener: (message: unknown) => void) => {
        onMessage = listener;
      },
      off: () => void 0,
      join: () => void 0,
      leave: () => void 0,
      send: () => void 0
    } as unknown as network.Room<PixelNetworkCommand, PixelServerMessage>;
    const { vr, updatedTilesets } = makeFakeVoxelRenderer();
    const manager = makeFakeManager(() => false) as PixelArtCanvas & {
      loadSnapshot: () => void;
    };
    manager.loadSnapshot = () => void 0;

    const bridge = new TextureEditorBridge();
    bridge.attach(manager, room);
    bridge.loadTileset(vr, "atlas");

    onMessage!({
      type: "snapshot",
      data: {
        size: { x: 4, y: 4 },
        pixels: "",
        uvRegions: []
      }
    });

    assert.deepEqual(updatedTilesets, ["atlas"]);
    bridge.destroy();
  });
});

describe("TextureEditorBridge / derived transparency", () => {
  it("derives the flag as soon as a tileset loads, before any drawing", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager(() => true));
    bridge.loadTileset(vr, "atlas");

    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, true);
    assert.deepEqual(dirtyReasons, ["block definitions updated"]);
    bridge.destroy();
  });

  it("derives it again once a block moves onto another tile", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      transparent: true,
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    const bridge = new TextureEditorBridge();
    // Only the second column of the atlas holds alpha.
    bridge.attach(makeFakeManager((rect) => rect.x === 16));
    bridge.loadTileset(vr, "atlas");
    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, false);

    applyBlockUpdate(vr, {
      ...vr.engine.blockRegistry.get(1)!,
      defaultTexture: { tilesetId: "atlas", col: 1, row: 0 }
    });

    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, true);
    bridge.destroy();
  });

  it("derives it for a block registered after the tileset loaded", () => {
    const { vr } = makeFakeVoxelRenderer();

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager(() => true));
    bridge.loadTileset(vr, "atlas");

    applyBlockUpdate(vr, makeBlock(7, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    assert.equal(vr.engine.blockRegistry.get(7)!.transparent, true);
    bridge.destroy();
  });

  it("settles in a single pass, without the write-back re-entering itself", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager(() => true));
    bridge.loadTileset(vr, "atlas");

    assert.deepEqual(dirtyReasons, ["block definitions updated"]);
    bridge.destroy();
  });

  it("stops deriving once destroyed", () => {
    const { vr } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    const bridge = new TextureEditorBridge();
    bridge.attach(makeFakeManager(() => true));
    bridge.loadTileset(vr, "atlas");
    bridge.destroy();

    applyBlockUpdate(vr, makeBlock(2, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    assert.equal(vr.engine.blockRegistry.get(2)!.transparent, undefined);
  });
});
