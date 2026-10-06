// Import Third-party Dependencies
import type {
  IslandFace,
  PixelDocument
} from "@jolly-pixel/pixel-draw.renderer";
import type {
  BlockShapeRegistry,
  BlocksetDocument,
  BlocksetDocumentCommandAction
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { BlockProjection } from "./BlockProjection.ts";

// CONSTANTS
const kIslandActions: ReadonlySet<BlocksetDocumentCommandAction> = new Set([
  "block-defined",
  "block-removed",
  "tile-size-updated"
]);

export type BlocksetIslandsTarget = Pick<
  PixelDocument,
  "useIslandFaces" | "invalidateIslands"
>;

export interface BlocksetIslandsOptions {
  blockset: Pick<BlocksetDocument, "blocks" | "tileSize" | "subscribe">;
  shapes: Pick<BlockShapeRegistry, "get">;
}

export class BlocksetIslands {
  readonly #blockset: BlocksetIslandsOptions["blockset"];
  readonly #shapes: BlocksetIslandsOptions["shapes"];

  constructor(
    options: BlocksetIslandsOptions
  ) {
    this.#blockset = options.blockset;
    this.#shapes = options.shapes;
  }

  faces(): IslandFace[] {
    const { tileSize } = this.#blockset;

    return [...this.#blockset.blocks].flatMap(
      (block) => new BlockProjection(
        block,
        this.#shapes.get(block.shapeId),
        tileSize
      ).islandFaces()
    );
  }

  attachTo(
    pixels: BlocksetIslandsTarget
  ): () => void {
    const release = pixels.useIslandFaces(() => this.faces());
    const unsubscribers = [
      this.#blockset.subscribe("loaded", () => pixels.invalidateIslands()),
      this.#blockset.subscribe("command", (command) => {
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
