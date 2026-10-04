// Import Internal Dependencies
import { Fill } from "./Fill.ts";
import type {
  Brush,
  BrushColorSlot
} from "./Brush.ts";
import type {
  CanvasBuffer
} from "../buffer/CanvasBuffer.ts";
import type { PixelDocument } from "../PixelDocument.ts";
import type { UVMap } from "../uv/map/UVMap.ts";
import { pointInGeometry } from "../uv/geometry/geometry.ts";
import {
  uvSlotGeometries,
  uvSlotMask
} from "../uv/region/uvSlotMask.ts";
import { rgba8Equal } from "../utils/colors.ts";
import type { Vec2 } from "../types.ts";

export interface FillEngineOptions {
  brush: Brush;
  document: Pick<
    PixelDocument,
    "buffer" | "uv" | "paintPixels" | "paintGlobalFill"
  >;
}

export interface FillTool {
  global: boolean;
  uvClip: boolean;
}

export class FillEngine implements FillTool {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #document: Pick<PixelDocument, "paintPixels" | "paintGlobalFill">;
  #uvMap: UVMap;
  #global = false;
  #uvClip = false;

  constructor(
    options: FillEngineOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.document.buffer;
    this.#document = options.document;
    this.#uvMap = options.document.uv;
  }

  get global(): boolean {
    return this.#global;
  }

  set global(
    global: boolean
  ) {
    this.#global = global;
  }

  get uvClip(): boolean {
    return this.#uvClip;
  }

  set uvClip(
    uvClip: boolean
  ) {
    this.#uvClip = uvClip;
  }

  run(
    tx: number,
    ty: number,
    slot: BrushColorSlot = "primary"
  ): void {
    const seed = { x: tx, y: ty };
    if (this.#global) {
      this.#runGlobal(
        seed,
        slot
      );

      return;
    }

    const [beforeColor] = this.#canvasBuffer.samplePixels([seed]);
    const fillColor = this.#brush[slot].asRGBA();
    const positions = Fill.floodFill(
      this.#canvasBuffer,
      seed,
      fillColor,
      this.#clipMask(seed)
    );
    this.#document.paintPixels(
      positions,
      fillColor,
      beforeColor
    );
  }

  #runGlobal(
    seed: Vec2,
    slot: BrushColorSlot
  ): void {
    const [fromColor] = this.#canvasBuffer.samplePixels([seed]);
    const toColor = this.#brush[slot].asRGBA();
    if (rgba8Equal(fromColor, toColor)) {
      return;
    }

    const mask = this.#clipMask(seed);
    const positions = this.#canvasBuffer.positionsOf(
      fromColor,
      mask
    );
    if (positions.length === 0) {
      return;
    }

    if (mask) {
      this.#document.paintPixels(
        positions,
        toColor,
        fromColor
      );

      return;
    }

    this.#document.paintGlobalFill({
      positions,
      fromColor,
      toColor
    });
  }

  #clipMask(
    seed: Vec2
  ): Uint8Array | undefined {
    if (!this.#uvClip) {
      return undefined;
    }

    const slots = uvSlotGeometries(this.#uvMap.regions);
    if (slots.length === 0) {
      return undefined;
    }

    const size = this.#canvasBuffer.size();
    const center = {
      x: seed.x + 0.5,
      y: seed.y + 0.5
    };
    const seedSlots = slots.filter(
      (geometry) => pointInGeometry(center, geometry)
    );
    if (seedSlots.length > 0) {
      return uvSlotMask(seedSlots, size);
    }

    const mask = uvSlotMask(slots, size);
    for (let index = 0; index < mask.length; index++) {
      mask[index] ^= 1;
    }

    return mask;
  }
}
