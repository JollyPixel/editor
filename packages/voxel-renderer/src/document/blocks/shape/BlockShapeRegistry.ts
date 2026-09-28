// Import Internal Dependencies
import type {
  BlockShape,
  BlockShapeID
} from "./BlockShape.ts";
import { Cube } from "./library/Cube.ts";
import { Pole } from "./library/Pole.ts";
import { PoleY } from "./library/PoleY.ts";
import { Ramp } from "./library/Ramp.ts";
import {
  RampCornerInner,
  RampCornerOuter
} from "./library/RampCorner.ts";
import { Slab } from "./library/Slab.ts";
import { Stair } from "./library/Stair.ts";
import { StairCornerInner } from "./library/StairCornerInner.ts";
import { StairCornerOuter } from "./library/StairCornerOuter.ts";

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
