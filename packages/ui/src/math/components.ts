// Import Internal Dependencies
import { isTransformLike } from "./guards.ts";

// CONSTANTS
const kAxes: readonly string[] = ["x", "y", "z", "w"];

export function snapshotComponents(
  value: unknown
): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (isTransformLike(value)) {
    return {
      position: snapshotComponents(value.position),
      rotation: snapshotComponents(value.rotation),
      scale: snapshotComponents(value.scale)
    };
  }

  const record = value as Record<string, unknown>;
  const snapshot: Record<string, number> = {};
  for (const axis of kAxes) {
    const component = record[axis];
    if (typeof component === "number") {
      snapshot[axis] = component;
    }
  }

  return snapshot;
}

export function copyComponents(
  target: unknown,
  source: unknown
): void {
  if (
    typeof target !== "object" || target === null ||
    typeof source !== "object" || source === null
  ) {
    return;
  }
  if (isTransformLike(target) && isTransformLike(source)) {
    copyComponents(target.position, source.position);
    copyComponents(target.rotation, source.rotation);
    copyComponents(target.scale, source.scale);

    return;
  }

  const into = target as Record<string, unknown>;
  const from = source as Record<string, unknown>;
  for (const axis of kAxes) {
    const component = from[axis];
    if (typeof component === "number" && typeof into[axis] === "number") {
      into[axis] = component;
    }
  }
}
