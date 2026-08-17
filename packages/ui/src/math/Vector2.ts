// Import Third-party Dependencies
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { VectorField } from "./VectorField.ts";

export type Vector2Axis = "x" | "y";

// CONSTANTS
const kAxisKeys: readonly Vector2Axis[] = ["x", "y"];

@customElement("jolly-vector2")
export class Vector2 extends VectorField<Vector2Axis> {
  protected override getAxisKeys(): readonly Vector2Axis[] {
    return kAxisKeys;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-vector2": Vector2;
  }
}
