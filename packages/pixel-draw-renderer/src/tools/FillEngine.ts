// Import Internal Dependencies
import { Fill } from "./Fill.ts";
import type {
  Brush,
  BrushColorSlot
} from "./Brush.ts";
import type {
  CanvasBuffer
} from "../buffer/CanvasBuffer.ts";
import type { EditPipeline } from "../sync/EditPipeline.ts";
import type { UVMap } from "../uv/UVMap.ts";
import { pointInGeometry } from "../uv/geometry.ts";
import {
  uvSlotGeometries,
  uvSlotMask
} from "../uv/uvSlotMask.ts";
import type {
  RGBA8,
  Vec2
} from "../types.ts";

export interface FillGlobalCommit {
  positions: Vec2[];
  beforeColors: RGBA8[];
  fromColor: RGBA8;
  toColor: RGBA8;
}

export interface FillEngineOptions {
  brush: Brush;
  canvasBuffer: CanvasBuffer;
  pipeline: EditPipeline;
  uvMap: UVMap;
}

export interface FillTool {
  global: boolean;
  uvClip: boolean;
}

export class FillEngine implements FillTool {
  #brush: Brush;
  #canvasBuffer: CanvasBuffer;
  #pipeline: EditPipeline;
  #uvMap: UVMap;
  #global = false;
  #uvClip = false;

  constructor(
    options: FillEngineOptions
  ) {
    this.#brush = options.brush;
    this.#canvasBuffer = options.canvasBuffer;
    this.#pipeline = options.pipeline;
    this.#uvMap = options.uvMap;
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

    const [r, g, b, a] = this.#canvasBuffer.samplePixel(
      tx,
      ty
    );
    const beforeColor = { r, g, b, a };
    const fillColor = this.#brush[slot].asRGBA();
    const positions = Fill.floodFill(
      this.#canvasBuffer,
      seed,
      fillColor,
      this.#clipMask(seed)
    );
    this.#pipeline.commitPixels(
      positions,
      slot,
      beforeColor
    );
  }

  #runGlobal(
    seed: Vec2,
    slot: BrushColorSlot
  ): void {
    const [sr, sg, sb, sa] = this.#canvasBuffer.samplePixel(
      seed.x,
      seed.y
    );
    const fromColor: RGBA8 = {
      r: sr,
      g: sg,
      b: sb,
      a: sa
    };
    const toColor = this.#brush[slot].asRGBA();

    if (
      fromColor.r === toColor.r &&
      fromColor.g === toColor.g &&
      fromColor.b === toColor.b &&
      fromColor.a === toColor.a
    ) {
      return;
    }

    const mask = this.#clipMask(seed);
    const positions = Fill.matchAll(
      this.#canvasBuffer,
      fromColor,
      mask
    );
    if (positions.length === 0) {
      return;
    }

    if (mask) {
      this.#pipeline.commitPixels(
        positions,
        slot,
        fromColor
      );

      return;
    }

    const beforeColors = positions.map(
      () => fromColor
    );
    this.#pipeline.commitGlobalFill({
      positions,
      beforeColors,
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
