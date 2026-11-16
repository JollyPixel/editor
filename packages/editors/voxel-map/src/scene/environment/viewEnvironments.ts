// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { LightingMode } from "../../state/ViewSettings.ts";

// CONSTANTS
const kWhite = "#ffffff";
export const STUDIO_SUN: Readonly<Systems.EnvironmentSunFile> = {
  color: kWhite,
  intensity: 2.25,
  azimuth: 45,
  elevation: 54.7356
};
export const STUDIO_AMBIENT: Readonly<Systems.EnvironmentAmbientFile> = {
  skyColor: kWhite,
  groundColor: kWhite,
  intensity: 1.3
};
const kStudio: Systems.EnvironmentFile = {
  ...Systems.ENVIRONMENT_PRESETS.default,
  sun: STUDIO_SUN,
  ambient: STUDIO_AMBIENT,
  reflections: {
    kind: "room",
    intensity: 0.6
  },
  toneMapping: {
    kind: "neutral",
    exposure: 1
  }
};
const kFlat: Systems.EnvironmentFile = {
  ...kStudio,
  sun: null,
  ambient: {
    skyColor: kWhite,
    groundColor: kWhite,
    intensity: Math.PI
  },
  toneMapping: {
    kind: "none",
    exposure: 1
  }
};
const kViewEnvironments: Readonly<
  Record<LightingMode, Readonly<Systems.EnvironmentFile>>
> = {
  studio: kStudio,
  flat: kFlat,
  day: Systems.ENVIRONMENT_PRESETS.day,
  night: Systems.ENVIRONMENT_PRESETS.night
};

export function viewEnvironment(
  mode: LightingMode
): Readonly<Systems.EnvironmentFile> {
  return kViewEnvironments[mode];
}
