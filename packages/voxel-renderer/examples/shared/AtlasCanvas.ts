// Import Third-party Dependencies
import type {
  BlocksetDefinition,
  ResolvedTileRef
} from "@jolly-pixel/voxel.renderer";

export interface AtlasCanvasOptions {
  cols: number;
  rows: number;
  tileSize: number;
}

export type AtlasTilePainter = (
  context: CanvasRenderingContext2D,
  size: number
) => void;

export class AtlasCanvas {
  readonly cols: number;
  readonly rows: number;
  readonly tileSize: number;

  #canvas = document.createElement("canvas");
  #context: CanvasRenderingContext2D;

  constructor(
    options: AtlasCanvasOptions
  ) {
    const { cols, rows, tileSize } = options;
    this.cols = cols;
    this.rows = rows;
    this.tileSize = tileSize;

    this.#canvas.width = cols * tileSize;
    this.#canvas.height = rows * tileSize;
    const context = this.#canvas.getContext("2d");
    if (!context) {
      throw new Error("AtlasCanvas: unable to acquire a 2D canvas context");
    }
    this.#context = context;
  }

  tileAt(
    index: number
  ): ResolvedTileRef {
    return {
      col: index % this.cols,
      row: Math.floor(index / this.cols)
    };
  }

  paint(
    tile: ResolvedTileRef,
    painter: AtlasTilePainter
  ): void {
    this.#context.save();
    this.#context.translate(tile.col * this.tileSize, tile.row * this.tileSize);
    painter(this.#context, this.tileSize);
    this.#context.restore();
  }

  putImage(
    tile: ResolvedTileRef,
    image: ImageData
  ): void {
    this.#context.putImageData(
      image,
      tile.col * this.tileSize,
      tile.row * this.tileSize
    );
  }

  toDataURL(): string {
    return this.#canvas.toDataURL("image/png");
  }

  toBlockset(
    id: string
  ): BlocksetDefinition {
    return {
      id,
      src: this.toDataURL(),
      tileSize: this.tileSize,
      cols: this.cols,
      rows: this.rows
    };
  }
}
