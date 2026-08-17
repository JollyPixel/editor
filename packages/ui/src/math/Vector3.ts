// Import Third-party Dependencies
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { VectorField } from "./VectorField.ts";

export type Vector3Axis = "x" | "y" | "z";

// CONSTANTS
const kAxisKeys: readonly Vector3Axis[] = ["x", "y", "z"];

@customElement("jolly-vector3")
export class Vector3 extends VectorField<Vector3Axis> {
  protected override getAxisKeys(): readonly Vector3Axis[] {
    return kAxisKeys;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-vector3": Vector3;
  }
}
