// Import Third-party Dependencies
import type * as THREE from "three/webgpu";

export interface SpriteFlip {
  horizontal: boolean;
  vertical: boolean;
}

export class SpriteSheet {
  readonly columns: number;
  readonly rows: number;

  constructor(
    columns: number,
    rows: number
  ) {
    if (!Number.isInteger(columns) || columns < 1) {
      throw new RangeError(
        `A sprite sheet needs at least one column, got ${columns}.`
      );
    }
    if (!Number.isInteger(rows) || rows < 1) {
      throw new RangeError(
        `A sprite sheet needs at least one row, got ${rows}.`
      );
    }

    this.columns = columns;
    this.rows = rows;
  }

  writeFrame(
    texture: THREE.Texture,
    frame: number,
    flip: Readonly<SpriteFlip>
  ): void {
    const column = frame % this.columns;
    const row = this.rows - Math.floor(frame / this.columns) - 1;

    texture.repeat.set(
      (flip.horizontal ? -1 : 1) / this.columns,
      (flip.vertical ? -1 : 1) / this.rows
    );
    texture.offset.set(
      (flip.horizontal ? column + 1 : column) / this.columns,
      (flip.vertical ? row + 1 : row) / this.rows
    );
  }
}
