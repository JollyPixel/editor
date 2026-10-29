// Import Internal Dependencies
import { FieldPatch } from "./FieldPatch.ts";
import type {
  SceneTransformField,
  SceneTransformJSON,
  SceneTransformPatch,
  SceneTransformView,
  Vector3JSON
} from "../network/types.ts";

// CONSTANTS
const kIdentity: Readonly<Record<SceneTransformField, Readonly<Vector3JSON>>> = {
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
};

export class SceneTransform {
  static readonly FIELDS: readonly SceneTransformField[] = [
    "position",
    "rotation",
    "scale"
  ];

  static create(
    fields: Partial<SceneTransformJSON> = {}
  ): SceneTransformJSON {
    return {
      position: { ...fields.position ?? kIdentity.position },
      rotation: { ...fields.rotation ?? kIdentity.rotation },
      scale: { ...fields.scale ?? kIdentity.scale }
    };
  }

  static compact(
    transform: SceneTransformJSON
  ): Partial<SceneTransformJSON> {
    return Object.fromEntries(
      SceneTransform.FIELDS
        .filter((field) => !SceneTransform.#sameVector(transform[field], kIdentity[field]))
        .map((field) => [field, { ...transform[field] }])
    );
  }

  static patch(
    transform: SceneTransformPatch
  ): FieldPatch<SceneTransformView> {
    return new FieldPatch<SceneTransformView>(SceneTransform.FIELDS, transform);
  }

  static #sameVector(
    left: Vector3JSON,
    right: Vector3JSON
  ): boolean {
    return left.x === right.x &&
      left.y === right.y &&
      left.z === right.z;
  }
}
