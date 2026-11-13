// Import Third-party Dependencies
import {
  RectArea,
  type SelectionRect,
  type Vec2
} from "@jolly-pixel/pixel-draw.renderer";

export type CellSize = Pick<SelectionRect, "width" | "height">;

export class TextureSpace {
  readonly size: Readonly<Vec2>;
  readonly #taken: readonly SelectionRect[];

  constructor(
    size: Vec2,
    taken: Iterable<SelectionRect> = []
  ) {
    this.size = {
      x: size.x,
      y: size.y
    };
    this.#taken = [...taken];
  }

  isFree(
    rect: SelectionRect
  ): boolean {
    return rect.x + rect.width <= this.size.x &&
      rect.y + rect.height <= this.size.y &&
      !this.#taken.some((bounds) => RectArea.from(bounds).intersects(rect));
  }

  freeCell(
    cell: CellSize
  ): Vec2 | null {
    const columns = Math.floor(this.size.x / cell.width);
    const rows = Math.floor(this.size.y / cell.height);

    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        const candidate = {
          x: column * cell.width,
          y: row * cell.height,
          width: cell.width,
          height: cell.height
        };
        if (this.isFree(candidate)) {
          return {
            x: candidate.x,
            y: candidate.y
          };
        }
      }
    }

    return null;
  }

  taking(
    ...rects: SelectionRect[]
  ): TextureSpace {
    return new TextureSpace(this.size, [...this.#taken, ...rects]);
  }

  grown(): TextureSpace {
    const { x, y } = this.size;
    const size = x <= y ?
      { x: x * 2, y } :
      { x, y: y * 2 };

    return new TextureSpace(size, this.#taken);
  }
}
