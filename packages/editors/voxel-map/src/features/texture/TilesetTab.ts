// Import Third-party Dependencies
import type {
  TilesetDefinition,
  VoxelEngine
} from "@jolly-pixel/voxel.renderer";
import type * as network from "@jolly-pixel/network";
import type {
  PixelNetworkCommand,
  PixelServerMessage
} from "@jolly-pixel/asset.pixel-art/network/client.ts";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  BrushStore,
  WorldStore
} from "../../app/state/index.ts";
import { TextureEditorBridge } from "./bridge/TextureEditorBridge.ts";
import { BlockUvBridge } from "./bridge/BlockUvBridge.ts";
import { definitionsEqual } from "../tilesets/tilesetEntries.ts";

export type TextureRoom = network.Room<PixelNetworkCommand, PixelServerMessage>;

export interface TilesetTabOptions {
  canvas: PixelArtCanvas;
  engine: VoxelEngine;
  definition: TilesetDefinition;
  room?: TextureRoom;
  brush: BrushStore;
  worldStore: WorldStore;
}

export class TilesetTab {
  readonly canvas: PixelArtCanvas;
  readonly #engine: VoxelEngine;
  readonly #bridge: TextureEditorBridge;
  readonly #uvBridge: BlockUvBridge;
  readonly #room: TextureRoom | undefined;
  #definition: TilesetDefinition;

  constructor(
    options: TilesetTabOptions
  ) {
    const { canvas, engine, definition } = options;

    this.canvas = canvas;
    this.#engine = engine;
    this.#definition = definition;
    this.#room = options.room;
    this.#bridge = new TextureEditorBridge({ worldStore: options.worldStore });
    this.#bridge.attach(canvas, options.room);
    this.#uvBridge = new BlockUvBridge(canvas.uv, engine, {
      runLocalRestore: (fn) => canvas.runLocalRestore(fn),
      brush: options.brush,
      worldStore: options.worldStore
    });
    this.#apply();
  }

  get definition(): TilesetDefinition {
    return this.#definition;
  }

  update(
    definition: TilesetDefinition
  ): void {
    if (definitionsEqual(definition, this.#definition)) {
      return;
    }

    this.#definition = definition;
    this.#apply();
  }

  dispose(): void {
    this.#uvBridge.dispose();
    this.#bridge.destroy();
    this.#room?.leave();
  }

  #apply(): void {
    this.#bridge.loadTileset(this.#engine, this.#definition);
    this.#uvBridge.setActiveTileset(
      this.#definition.id,
      this.#definition.tileSize
    );
  }
}
