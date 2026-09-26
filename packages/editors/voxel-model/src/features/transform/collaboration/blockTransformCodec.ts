// Import Third-party Dependencies
import type {
  BlockTransformJSON,
  Vector3JSON
} from "@jolly-pixel/asset.voxel-model/client";

export function parseBlockTransformJSON(
  value: unknown
): BlockTransformJSON | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const position = parseVector3JSON(Reflect.get(value, "position"));
  const pivotOffset = parseVector3JSON(Reflect.get(value, "pivotOffset"));
  const size = parseVector3JSON(Reflect.get(value, "size"));
  const scale = parseVector3JSON(Reflect.get(value, "scale"));
  const rotation = parseVector3JSON(Reflect.get(value, "rotation"));

  return (
    position === undefined ||
    pivotOffset === undefined ||
    size === undefined ||
    scale === undefined ||
    rotation === undefined
  ) ? undefined : { position, pivotOffset, size, scale, rotation };
}

function parseVector3JSON(
  value: unknown
): Vector3JSON | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  const x: unknown = Reflect.get(value, "x");
  const y: unknown = Reflect.get(value, "y");
  const z: unknown = Reflect.get(value, "z");

  return (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof z !== "number"
  ) ? undefined : { x, y, z };
}
