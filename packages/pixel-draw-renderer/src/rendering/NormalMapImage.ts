// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  createCanvas2D,
  type Canvas2D
} from "./Canvas2D.ts";
import type { NormalMap } from "../normal/NormalMap.ts";
import { RectArea } from "../utils/RectArea.ts";
import type {
  SelectionRect,
  Vec2
} from "../types.ts";

export type NormalMapImageEvent = {
  changed: () => void;
};

export class NormalMapImage extends Emitter<NormalMapImageEvent> {
  #normals: NormalMap;
  #surface: Canvas2D;
  #release: () => void;

  constructor(
    normals: NormalMap
  ) {
    super();
    this.#normals = normals;
    this.#surface = createCanvas2D(1, 1);
    this.#release = normals.retain();
    normals.flush();

    const size = normals.size;
    this.#resize(size);
    this.#copy({
      x: 0,
      y: 0,
      width: size.x,
      height: size.y
    });
    normals.on("resized", this.#onResized);
    normals.on("changed", this.#onChanged);
  }

  canvas(): HTMLCanvasElement {
    return this.#surface.canvas;
  }

  dispose(): void {
    this.#normals.off("resized", this.#onResized);
    this.#normals.off("changed", this.#onChanged);
    this.#release();
  }

  readonly #onResized = (
    event: { size: Vec2; }
  ): void => {
    this.#resize(event.size);
  };

  readonly #onChanged = (
    event: { bounds: SelectionRect; }
  ): void => {
    this.#copy(event.bounds);
    this.emit("changed");
  };

  #resize(
    size: Vec2
  ): void {
    const { canvas } = this.#surface;
    canvas.width = Math.max(size.x, 1);
    canvas.height = Math.max(size.y, 1);
    this.#surface.context.imageSmoothingEnabled = false;
  }

  #copy(
    bounds: SelectionRect
  ): void {
    const size = this.#normals.size;
    const area = RectArea.from(bounds);
    const clipped = area.intersection(size);
    if (clipped === null) {
      return;
    }

    const { context } = this.#surface;
    const image = context.createImageData(
      clipped.width,
      clipped.height
    );
    const pixels = this.#normals.pixels;
    let offset = 0;
    for (const row of area.rowsWithin(size)) {
      const start = row.indexInBounds * 4;
      const length = row.length * 4;
      image.data.set(
        pixels.subarray(start, start + length),
        offset
      );
      offset += length;
    }

    context.putImageData(
      image,
      clipped.x,
      clipped.y
    );
  }
}
