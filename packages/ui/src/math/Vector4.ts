// Import Third-party Dependencies
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { VectorField } from "./VectorField.ts";

export type Vector4Axis = "x" | "y" | "z" | "w";

// CONSTANTS
const kAxisKeys: readonly Vector4Axis[] = ["x", "y", "z", "w"];

@customElement("jolly-vector4")
export class Vector4 extends VectorField<Vector4Axis> {
  protected override getAxisKeys(): readonly Vector4Axis[] {
    return kAxisKeys;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-vector4": Vector4;
  }
}
