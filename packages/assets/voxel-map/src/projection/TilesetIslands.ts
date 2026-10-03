// Import Third-party Dependencies
import type {
  IslandFace,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  BlockShapeRegistry,
  TilesetDocument,
  TilesetDocumentCommandAction
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockProjection } from "./BlockProjection.ts";

// CONSTANTS
const kIslandActions: ReadonlySet<TilesetDocumentCommandAction> = new Set([
  "block-defined",
  "block-removed",
  "tile-size-updated"
]);

export type TilesetIslandsTarget = Pick<
  PixelDocument,
  "useIslandFaces" | "invalidateIslands"
>;

export interface TilesetIslandsOptions {
  tileset: Pick<TilesetDocument, "blocks" | "tileSize" | "subscribe">;
  shapes: Pick<BlockShapeRegistry, "get">;
}

export class TilesetIslands {
  readonly #tileset: TilesetIslandsOptions["tileset"];
  readonly #shapes: TilesetIslandsOptions["shapes"];

  constructor(
    options: TilesetIslandsOptions
  ) {
    this.#tileset = options.tileset;
    this.#shapes = options.shapes;
  }

  faces(): IslandFace[] {
    const { tileSize } = this.#tileset;

    return [...this.#tileset.blocks].flatMap(
      (block) => new BlockProjection(
        block,
        this.#shapes.get(block.shapeId),
        tileSize
      ).islandFaces()
    );
  }

  attachTo(
    pixels: TilesetIslandsTarget
  ): () => void {
    const release = pixels.useIslandFaces(() => this.faces());
    const unsubscribers = [
      this.#tileset.subscribe("loaded", () => pixels.invalidateIslands()),
      this.#tileset.subscribe("command", (command) => {
        if (kIslandActions.has(command.action)) {
          pixels.invalidateIslands();
        }
      })
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      release();
    };
  }
}
