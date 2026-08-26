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
  CanvasBufferEvent,
  PixelArtCanvas,
  PixelNetworkCommand,
  PixelServerMessage,
  SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";
import type * as network from "@jolly-pixel/network";
import { Emitter } from "@openally/emitt";
import { fromUint8Array } from "js-base64";

// Import Internal Dependencies
import { TextureEditorBridge } from "../../../src/features/texture/TextureEditorBridge.ts";
import { applyBlockUpdate } from "../../../src/features/blocks/applyBlockUpdate.ts";

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
  updatedRegions: SelectionRect[];
} {
  const dirtyReasons: string[] = [];
  const updatedTilesets: string[] = [];
  const updatedRegions: SelectionRect[] = [];
  const tilesetManager = {
    getSourceTexture: () => {
      return { image };
    },
    updateSourceImage: (_image: object, id: string) => {
      updatedTilesets.push(id);
    },
    updateSourceRegion: (
      _image: object,
      bounds: SelectionRect,
      _id: string
    ) => {
      updatedRegions.push(bounds);
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
    updatedTilesets,
    updatedRegions
  };
}

/**
 * Drains the bridge's frame loop on demand: it schedules through the injected
 * scheduler, so a test decides when a frame happens.
 */
function makeScheduler() {
  const queue: (() => void)[] = [];

  return {
    schedule: (callback: () => void) => {
      queue.push(callback);
    },
    /** Runs one frame; the callback reschedules itself for the next. */
    frame() {
      const next = queue.shift();
      next?.();
    }
  };
}

type FakeManager = PixelArtCanvas & {
  document: Emitter<CanvasBufferEvent>;
  /** Scope depth at each texture assignment; 0 means it broadcast. */
  textureSetDepths: number[];
};

function makeFakeManager(
  hasTransparency: (rect: SelectionRect) => boolean
): FakeManager {
  const fakeCanvas = { toDataURL: () => "data:image/png;base64," } as unknown as HTMLCanvasElement;
  const textureSetDepths: number[] = [];
  let depth = 0;

  return {
    document: new Emitter<CanvasBufferEvent>(),
    textureSize: { x: 64, y: 64 },
    textureCanvas: () => fakeCanvas,
    hasTransparency,
    textureSetDepths,
    loadSnapshot: () => void 0,
    set texture(_source: HTMLImageElement) {
      textureSetDepths.push(depth);
    },
    runLocalRestore: <T>(fn: () => T): T => {
      depth++;
      try {
        return fn();
      }
      finally {
        depth--;
      }
    }
  } as unknown as FakeManager;
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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
    document: new Emitter<CanvasBufferEvent>(),
    textureSize: { x: 64, y: 64 },
    get assigned() {
      return assigned;
    },
    textureCanvas: () => fakeCanvas,
    hasTransparency: () => false,
    set texture(source: HTMLImageElement) {
      assigned = source;
    },
    runLocalRestore: <T>(fn: () => T): T => fn()
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
    bridge.attach(manager);

    const logged = captureErrors(() => bridge.loadTileset(vr, "atlas"));

    assert.deepEqual(logged, []);
    assert.equal(manager.assigned!.naturalWidth, 1024);
    bridge.destroy();
  });

  it("refuses a source image wider than the limit instead of throwing", () => {
    const { vr } = makeFakeVoxelRenderer(makeImage(1024, 512));
    const manager = makeSizingManager(512);

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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
    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });

    bridge.attach(makeFakeManager(() => false), room);

    assert.deepEqual(calls, ["subscribe", "join"]);
    bridge.destroy();
  });
});

describe("TextureEditorBridge / streaming to the tileset", () => {
  it("repads only the tiles a stroke touched, once per frame", () => {
    const scheduler = makeScheduler();
    const { vr, updatedRegions, updatedTilesets } = makeFakeVoxelRenderer();
    const manager = makeFakeManager(() => false);

    const bridge = new TextureEditorBridge({ scheduler: scheduler.schedule });
    bridge.attach(manager);
    bridge.loadTileset(vr, "atlas");
    updatedTilesets.length = 0;

    manager.document.emit("changed", {
      bounds: { x: 2, y: 2, width: 2, height: 2 }
    });
    manager.document.emit("changed", {
      bounds: { x: 8, y: 8, width: 2, height: 2 }
    });
    scheduler.frame();

    assert.deepEqual(
      updatedRegions,
      [{ x: 2, y: 2, width: 8, height: 8 }],
      "one union of the frame's dirty bounds, not one call per pixel"
    );
    assert.deepEqual(
      updatedTilesets,
      [],
      "the whole atlas must not be repadded for a stroke"
    );
    bridge.destroy();
  });

  it("does nothing on a frame with no edits", () => {
    const scheduler = makeScheduler();
    const { vr, updatedRegions } = makeFakeVoxelRenderer();

    const bridge = new TextureEditorBridge({ scheduler: scheduler.schedule });
    bridge.attach(makeFakeManager(() => false));
    bridge.loadTileset(vr, "atlas");

    scheduler.frame();
    scheduler.frame();

    assert.deepEqual(updatedRegions, []);
    bridge.destroy();
  });

  it("falls back to a full repad after the texture is replaced", () => {
    const scheduler = makeScheduler();
    const { vr, updatedRegions, updatedTilesets } = makeFakeVoxelRenderer();
    const manager = makeFakeManager(() => false);

    const bridge = new TextureEditorBridge({ scheduler: scheduler.schedule });
    bridge.attach(manager);
    bridge.loadTileset(vr, "atlas");
    updatedTilesets.length = 0;

    // What a room snapshot lands as: CanvasBuffer.loadTexture swaps the
    // element, so the padded atlas has to be rebuilt whole.
    manager.document.emit("replaced", { size: { x: 64, y: 64 } });
    scheduler.frame();

    assert.deepEqual(updatedTilesets, ["atlas"]);
    assert.deepEqual(updatedRegions, []);

    // The incremental path resumes on the next stroke.
    manager.document.emit("changed", {
      bounds: { x: 0, y: 0, width: 2, height: 2 }
    });
    scheduler.frame();

    assert.deepEqual(updatedRegions, [{ x: 0, y: 0, width: 2, height: 2 }]);
    bridge.destroy();
  });

  it("stops flushing once destroyed", () => {
    const scheduler = makeScheduler();
    const { vr, updatedRegions } = makeFakeVoxelRenderer();
    const manager = makeFakeManager(() => false);

    const bridge = new TextureEditorBridge({ scheduler: scheduler.schedule });
    bridge.attach(manager);
    bridge.loadTileset(vr, "atlas");
    bridge.destroy();

    manager.document.emit("changed", {
      bounds: { x: 0, y: 0, width: 2, height: 2 }
    });
    scheduler.frame();

    assert.deepEqual(updatedRegions, []);
  });

  it("rescans only the blocks whose tiles the edit touched", () => {
    const scheduler = makeScheduler();
    const { vr } = makeFakeVoxelRenderer();
    // tileSize is 16: tile (0, 0) covers texels 0..15, tile (2, 2) 32..47.
    vr.engine.blockRegistry.register(makeBlock(1, {
      transparent: false,
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));
    vr.engine.blockRegistry.register(makeBlock(2, {
      transparent: false,
      defaultTexture: { tilesetId: "atlas", col: 2, row: 2 }
    }));

    let transparent = false;
    const manager = makeFakeManager(() => transparent);
    const bridge = new TextureEditorBridge({ scheduler: scheduler.schedule });
    bridge.attach(manager);
    bridge.loadTileset(vr, "atlas");

    // Both blocks now read as opaque. Make every tile read transparent, but
    // report an edit inside tile (0, 0) only.
    transparent = true;
    manager.document.emit("changed", {
      bounds: { x: 4, y: 4, width: 2, height: 2 }
    });
    scheduler.frame();

    assert.equal(vr.engine.blockRegistry.get(1)!.transparent, true);
    assert.equal(
      vr.engine.blockRegistry.get(2)!.transparent,
      false,
      "a block whose tile the stroke never reached must not be rescanned"
    );
    bridge.destroy();
  });
});

describe("TextureEditorBridge / derived transparency", () => {
  it("derives the flag as soon as a tileset loads, before any drawing", () => {
    const { vr, dirtyReasons } = makeFakeVoxelRenderer();
    vr.engine.blockRegistry.register(makeBlock(1, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
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

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
    bridge.attach(makeFakeManager(() => true));
    bridge.loadTileset(vr, "atlas");
    bridge.destroy();

    applyBlockUpdate(vr, makeBlock(2, {
      defaultTexture: { tilesetId: "atlas", col: 0, row: 0 }
    }));

    assert.equal(vr.engine.blockRegistry.get(2)!.transparent, undefined);
  });
});

describe("TextureEditorBridge / placeholder atlas", () => {
  /** A room whose snapshot the test delivers on demand. */
  function makeSnapshotRoom(): {
    room: network.Room<PixelNetworkCommand, PixelServerMessage>;
    deliverSnapshot: (size: { x: number; y: number; }) => void;
  } {
    const listeners: ((message: PixelServerMessage) => void)[] = [];
    const room = {
      clientId: "local",
      on: (
        _event: string,
        listener: (message: PixelServerMessage) => void
      ) => listeners.push(listener),
      off: () => void 0,
      join: () => void 0,
      leave: () => void 0,
      send: () => void 0
    } as unknown as network.Room<PixelNetworkCommand, PixelServerMessage>;

    return {
      room,
      deliverSnapshot: (size) => {
        for (const listener of listeners) {
          listener({
            type: "snapshot",
            data: {
              size,
              pixels: fromUint8Array(
                new Uint8Array(size.x * size.y * 4)
              ),
              uvRegions: []
            }
          });
        }
      }
    };
  }

  it("applies the shipped atlas inside a local-restore scope, never as an edit", () => {
    const { vr } = makeFakeVoxelRenderer();
    const manager = makeFakeManager(() => false);

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
    bridge.attach(manager);
    bridge.loadTileset(vr, "atlas");

    assert.deepEqual(manager.textureSetDepths, [1]);
    bridge.destroy();
  });

  it("leaves the room document alone once its snapshot has landed", () => {
    const { vr } = makeFakeVoxelRenderer();
    const manager = makeFakeManager(() => false);
    const { room, deliverSnapshot } = makeSnapshotRoom();

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
    bridge.attach(manager, room);
    deliverSnapshot({ x: 64, y: 64 });
    bridge.loadTileset(vr, "atlas");

    assert.deepEqual(manager.textureSetDepths, []);
    bridge.destroy();
  });

  it("still fills the gap while the room snapshot is outstanding", () => {
    const { vr } = makeFakeVoxelRenderer();
    const manager = makeFakeManager(() => false);
    const { room } = makeSnapshotRoom();

    const bridge = new TextureEditorBridge({ scheduler: () => void 0 });
    bridge.attach(manager, room);
    bridge.loadTileset(vr, "atlas");

    assert.deepEqual(manager.textureSetDepths, [1]);
    bridge.destroy();
  });
});
