// Import Third-party Dependencies
import {
  BlockTextureLayout,
  type BlockShape,
  type ResolvedBlockDefinition,
  type TileRect
} from "@jolly-pixel/voxel.renderer";
import { RectArea } from "@jolly-pixel/pixel-draw.renderer";

export interface AtlasExtent {
  width?: number;
  height?: number;
}

export interface TilePosition {
  col: number;
  row: number;
}

export type ShapeLookup = (shapeId: string) => BlockShape | undefined;

export class TileOccupancy {
  static of(
    blocks: Iterable<ResolvedBlockDefinition>,
    shapeOf: ShapeLookup,
    tilesetId: string,
    tileSize: number
  ): TileOccupancy {
    const rects = new Map<string, TileRect>();
    for (const block of blocks) {
      const layout = BlockTextureLayout.of(block, shapeOf(block.shapeId));
      for (const rect of layout.footprintsIn(tilesetId, tileSize)) {
        rects.set(`${rect.x}:${rect.y}:${rect.width}:${rect.height}`, rect);
      }
    }

    return new TileOccupancy(tileSize, [...rects.values()]);
  }

  readonly tileSize: number;
  readonly rects: readonly TileRect[];

  constructor(
    tileSize: number,
    rects: readonly TileRect[]
  ) {
    this.tileSize = tileSize;
    this.rects = rects;
  }

  firstFree(
    size: number,
    extent: AtlasExtent = {}
  ): TilePosition {
    const { tileSize } = this;
    const reach = this.#reach();
    const maxX = Math.min((extent.width ?? Infinity) - size, reach.x);
    const maxY = Math.min((extent.height ?? Infinity) - size, reach.y);

    for (let y = 0; y <= maxY; y += tileSize) {
      for (let x = 0; x <= maxX; x += tileSize) {
        const candidate = RectArea.from({
          x,
          y,
          width: size,
          height: size
        });
        if (!this.rects.some((rect) => candidate.intersects(rect))) {
          return {
            col: x / tileSize,
            row: y / tileSize
          };
        }
      }
    }

    return {
      col: 0,
      row: 0
    };
  }

  #reach(): Pick<TileRect, "x" | "y"> {
    const right = Math.max(0, ...this.rects.map((rect) => rect.x + rect.width));
    const bottom = Math.max(0, ...this.rects.map((rect) => rect.y + rect.height));

    return {
      x: Math.ceil(right / this.tileSize) * this.tileSize,
      y: Math.ceil(bottom / this.tileSize) * this.tileSize
    };
  }
}
