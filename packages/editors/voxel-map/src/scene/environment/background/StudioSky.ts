// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  color,
  float,
  mix,
  normalize,
  positionLocal,
  smoothstep
} from "three/tsl";
import type { ResolvedThemeMode } from "@jolly-pixel/ui";

// CONSTANTS
const kPalettes: Record<ResolvedThemeMode, StudioPalette> = {
  dark: {
    horizon: "#393b3f",
    zenith: "#1c1d20",
    ground: "#252629"
  },
  light: {
    horizon: "#f1f4f7",
    zenith: "#a7bfdb",
    ground: "#dce1e7"
  }
};

interface StudioPalette {
  horizon: string;
  zenith: string;
  ground: string;
}

export class StudioSky {
  readonly node: THREE.Node;

  constructor(
    theme: ResolvedThemeMode
  ) {
    const palette = kPalettes[theme];
    const up = normalize(positionLocal).y;
    const sky = mix(
      color(palette.horizon),
      color(palette.zenith),
      smoothstep(float(0), float(0.75), up)
    );

    this.node = mix(
      sky,
      color(palette.ground),
      smoothstep(float(0), float(-0.2), up)
    );
  }
}
