// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { EnvironmentFile } from "../network/types.ts";

type Fog = EnvironmentFile["fog"];
type Sky = EnvironmentFile["sky"];
type Sun = EnvironmentFile["sun"];
type Glow = EnvironmentFile["glow"];

export type EnvironmentFogKind = Fog["kind"];
export type EnvironmentSkyKind = Sky["kind"];

// CONSTANTS
const kFogColor = "#c8d2dc";
const kSkyColor = "#20252b";
const kDefaultFogs: {
  [TKind in EnvironmentFogKind]: Extract<Fog, { kind: TKind; }>;
} = {
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
};
const kDefaultGlow = {
  strength: 1,
  radius: 0.4
} as const;

export class EnvironmentSwitch {
  static fog(
    fog: Fog,
    kind: EnvironmentFogKind
  ): Fog {
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

  static sky(
    sky: Sky,
    kind: EnvironmentSkyKind
  ): Sky {
    if (kind === sky.kind) {
      return sky;
    }

    return kind === "color" ?
      { kind, color: kSkyColor } :
      { kind };
  }

  static sun(
    sun: Sun,
    enabled: boolean
  ): Sun {
    if (!enabled) {
      return null;
    }

    return sun ?? structuredClone(Systems.ENVIRONMENT_PRESETS.studio.sun);
  }

  static glow(
    glow: Glow,
    enabled: boolean
  ): Glow {
    if (!enabled) {
      return null;
    }

    return glow ?? { ...kDefaultGlow };
  }
}
