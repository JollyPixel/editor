// Import Internal Dependencies
import type { EnvironmentFile } from "./EnvironmentFile.ts";

export type EnvironmentPresetName = "default" | "studio" | "day" | "night";

// CONSTANTS
const kNeutralAmbient = "#ffffff";

export const ENVIRONMENT_PRESETS: Readonly<
  Record<EnvironmentPresetName, Readonly<EnvironmentFile>>
> = Object.freeze({
  default: {
    version: 1,
    sky: {
      kind: "none"
    },
    sun: null,
    ambient: {
      skyColor: kNeutralAmbient,
      groundColor: kNeutralAmbient,
      intensity: 0
    },
    reflections: {
      kind: "room",
      intensity: 1
    },
    fog: {
      kind: "none"
    },
    toneMapping: {
      kind: "neutral",
      exposure: 1.25
    },
    glow: null,
    voxel: {
      blockLightFalloff: "wide",
      shadowFill: 0
    }
  },
  studio: {
    version: 1,
    sky: {
      kind: "none"
    },
    sun: {
      color: kNeutralAmbient,
      intensity: 2,
      azimuth: 38.66,
      elevation: 51.34
    },
    ambient: {
      skyColor: "#dfe8ff",
      groundColor: "#3b3328",
      intensity: 1.2
    },
    reflections: {
      kind: "room",
      intensity: 0.6
    },
    fog: {
      kind: "none"
    },
    toneMapping: {
      kind: "neutral",
      exposure: 1.25
    },
    glow: null,
    voxel: {
      blockLightFalloff: "wide",
      shadowFill: 0
    }
  },
  day: {
    version: 1,
    sky: {
      kind: "day"
    },
    sun: {
      color: "#ffd9a3",
      intensity: 2.7,
      azimuth: -48,
      elevation: 33
    },
    ambient: {
      skyColor: "#bcd6f2",
      groundColor: "#8a7454",
      intensity: 1.15
    },
    reflections: {
      kind: "room",
      intensity: 0.6
    },
    fog: {
      kind: "none"
    },
    toneMapping: {
      kind: "aces",
      exposure: 1.05
    },
    glow: null,
    voxel: {
      blockLightFalloff: "wide",
      shadowFill: 0
    }
  },
  night: {
    version: 1,
    sky: {
      kind: "night"
    },
    sun: {
      color: "#a9bce8",
      intensity: 0.55,
      azimuth: 143,
      elevation: 51
    },
    ambient: {
      skyColor: "#2c3a66",
      groundColor: "#14121c",
      intensity: 0.35
    },
    reflections: {
      kind: "room",
      intensity: 0.08
    },
    fog: {
      kind: "none"
    },
    toneMapping: {
      kind: "aces",
      exposure: 0.9
    },
    glow: null,
    voxel: {
      blockLightFalloff: "focused",
      shadowFill: 1
    }
  }
});
