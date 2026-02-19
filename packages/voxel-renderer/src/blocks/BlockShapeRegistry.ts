// Import Internal Dependencies
import type { BlockShape } from "./BlockShape.ts";
import { Cube } from "./shapes/Cube.ts";
import { Slab } from "./shapes/Slab.ts";
import { Ramp } from "./shapes/Ramp.ts";
import { RampCornerInner, RampCornerOuter, RampCornerInnerFlip, RampCornerOuterFlip } from "./shapes/RampCorner.ts";
import { PoleY } from "./shapes/PoleY.ts";
import { Pole } from "./shapes/Pole.ts";
import { PoleCross } from "./shapes/PoleCross.ts";
import { RampFlip } from "./shapes/RampFlip.ts";
import {
  Stair,
  StairCornerInner,
  StairCornerOuter,
  StairFlip,
  StairCornerInnerFlip,
  StairCornerOuterFlip
} from "./shapes/Stair.ts";

/**
 * Registry that maps shape IDs to BlockShape implementations.
 * Register custom shapes at runtime via register() without touching core logic.
 */
export class BlockShapeRegistry {
  #shapes = new Map<string, BlockShape>();

  register(
    shape: BlockShape
  ): this {
    this.#shapes.set(shape.id, shape);

    return this;
  }

  get(
    id: string
  ): BlockShape | undefined {
    return this.#shapes.get(id);
  }

  has(
    id: string
  ): boolean {
    return this.#shapes.has(id);
  }

  static createDefault(): BlockShapeRegistry {
    const registry = new BlockShapeRegistry();

    registry
      .register(new Cube())
      .register(new Slab("bottom"))
      .register(new Slab("top"))
      .register(new PoleY())
      .register(new Pole("x"))
      .register(new Pole("z"))
      .register(new PoleCross())
      .register(new Ramp())
      .register(new RampFlip())
      .register(new RampCornerInner())
      .register(new RampCornerOuter())
      .register(new RampCornerInnerFlip())
      .register(new RampCornerOuterFlip())
      .register(new Stair())
      .register(new StairCornerInner())
      .register(new StairCornerOuter())
      .register(new StairFlip())
      .register(new StairCornerInnerFlip())
      .register(new StairCornerOuterFlip());

    return registry;
  }
}
