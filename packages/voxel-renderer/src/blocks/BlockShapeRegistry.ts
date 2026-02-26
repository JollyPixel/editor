// Import Internal Dependencies
import type { BlockShape } from "./BlockShape.ts";
import { Cube } from "./shapes/Cube.ts";
import { Slab } from "./shapes/Slab.ts";
import { Ramp } from "./shapes/Ramp.ts";
import { RampCornerInner, RampCornerOuter } from "./shapes/RampCorner.ts";
import { PoleY } from "./shapes/PoleY.ts";
import { Pole } from "./shapes/Pole.ts";
import { PoleCross } from "./shapes/PoleCross.ts";
import {
  Stair,
  StairCornerInner,
  StairCornerOuter
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
      .register(new RampCornerInner())
      .register(new RampCornerOuter())
      .register(new Stair())
      .register(new StairCornerInner())
      .register(new StairCornerOuter());

    return registry;
  }
}
