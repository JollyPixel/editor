// Import Third-party Dependencies
import type { SceneFogJSON } from "@jolly-pixel/asset.scene/client";

export type SceneFogKind = SceneFogJSON["kind"];

// CONSTANTS
const kFogColor = "#c8d2dc";
const kLinearNear = 10;
const kLinearFar = 100;
const kDensity = 0.02;

export function fogOfKind(
  kind: SceneFogKind,
  current: SceneFogJSON
): SceneFogJSON {
  if (kind === current.kind) {
    return current;
  }

  const color = current.kind === "none" ? kFogColor : current.color;
  switch (kind) {
    case "none":
      return { kind };
    case "linear":
      return {
        kind,
        color,
        near: kLinearNear,
        far: kLinearFar
      };
    case "exp2":
      return {
        kind,
        color,
        density: kDensity
      };
  }
}
