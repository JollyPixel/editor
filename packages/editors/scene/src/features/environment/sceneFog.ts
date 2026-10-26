// Import Third-party Dependencies
import type { SceneFogJSON } from "@jolly-pixel/asset.scene/client";

export type SceneFogKind = SceneFogJSON["kind"];
type DefaultFogs = {
  [TKind in SceneFogKind]: Extract<SceneFogJSON, { kind: TKind; }>;
};

// CONSTANTS
const kFogColor = "#c8d2dc";
const kDefaultFogs = {
  none: {
    kind: "none"
  },
  linear: {
    kind: "linear",
    color: kFogColor,
    near: 10,
    far: 100
  },
  exp2: {
    kind: "exp2",
    color: kFogColor,
    density: 0.02
  }
} satisfies DefaultFogs;

export function switchFogKind(
  fog: SceneFogJSON,
  kind: SceneFogKind
): SceneFogJSON {
  if (kind === fog.kind) {
    return fog;
  }
  if (kind === "none" || fog.kind === "none") {
    return { ...kDefaultFogs[kind] };
  }

  return {
    ...kDefaultFogs[kind],
    color: fog.color
  };
}
