// Import Third-party Dependencies
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { VectorField } from "./VectorField.ts";
import { axisKeysOf } from "./axes.ts";
import type {
  Vector2Axis,
  Vector2Pair,
  Vector2Value
} from "./types.ts";

@customElement("jolly-vector2")
export class Vector2 extends VectorField<
  Vector2Axis,
  Vector2Value
> {
  @property({ type: String, reflect: true })
  declare axes: Vector2Pair;

  constructor() {
    super();

    this.axes = "xy";
  }

  protected override getAxisKeys(): readonly Vector2Axis[] {
    return axisKeysOf(this.axes);
  }
}

export type {
  Vector2Axis,
  Vector2Pair,
  Vector2Value
};

declare global {
  interface HTMLElementTagNameMap {
    "jolly-vector2": Vector2;
  }
}
