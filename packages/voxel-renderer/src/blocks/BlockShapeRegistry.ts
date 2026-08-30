// Import Internal Dependencies
import type {
  BlockShape,
  BlockShapeID
} from "./BlockShape.ts";

import {
  Cube,
  Pole,
  PoleY,
  Ramp,
  RampCornerInner,
  RampCornerOuter,
  Slab,
  Stair,
  StairCornerInner,
  StairCornerOuter
} from "./shapes/index.ts";

export class BlockShapeRegistry implements Iterable<BlockShape> {
  #shapes = new Map<BlockShapeID, BlockShape>();
  #version = 0;

  register(
    shape: BlockShape
  ): this {
    this.#shapes.set(
      shape.id,
      shape
    );
    this.#version++;

    return this;
  }

  get version(): number {
    return this.#version;
  }

  get(
    id: BlockShapeID
  ): BlockShape | undefined {
    return this.#shapes.get(id);
  }

  has(
    id: BlockShapeID
  ): boolean {
    return this.#shapes.has(id);
  }

  getAll(): IterableIterator<BlockShape> {
    return this.#shapes.values();
  }

  ids(): IterableIterator<BlockShapeID> {
    return this.#shapes.keys();
  }

  [Symbol.iterator](): IterableIterator<BlockShape> {
    return this.getAll();
  }

  static createDefault(): BlockShapeRegistry {
    return new BlockShapeRegistry()
      .register(new Cube())
      .register(new Slab("bottom"))
      .register(new Slab("top"))
      .register(new PoleY())
      .register(new Pole())
      .register(new Ramp())
      .register(new RampCornerInner())
      .register(new RampCornerOuter())
      .register(new Stair())
      .register(new StairCornerInner())
      .register(new StairCornerOuter());
  }
}
