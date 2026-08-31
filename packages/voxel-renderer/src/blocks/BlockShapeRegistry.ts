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

  registerMany(
    shapes: Iterable<BlockShape>
  ): this {
    for (const shape of shapes) {
      this.register(shape);
    }

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
      .registerMany([
        new Cube(),
        new Slab("bottom"),
        new Slab("top"),
        new PoleY(),
        new Pole(),
        new Ramp(),
        new RampCornerInner(),
        new RampCornerOuter(),
        new Stair(),
        new StairCornerInner(),
        new StairCornerOuter()
      ]);
  }
}
