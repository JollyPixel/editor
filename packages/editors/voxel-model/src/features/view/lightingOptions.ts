// Import Third-party Dependencies
import type {
  IconName,
  JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import "./viewIcons.ts";
import {
  LIGHTING_MODES,
  type LightingMode
} from "../../state/index.ts";

export interface LightingOption extends JollyOption<LightingMode> {
  icon: IconName;
}

// CONSTANTS
const kLightingOptions: Record<LightingMode, LightingOption> = {
  flat: {
    value: "flat",
    label: "Flat",
    icon: "view-flat"
  },
  studio: {
    value: "studio",
    label: "Studio",
    icon: "view-studio"
  },
  day: {
    value: "day",
    label: "Day",
    icon: "view-day"
  },
  night: {
    value: "night",
    label: "Night",
    icon: "view-night"
  }
};

export const LIGHTING_OPTIONS: readonly LightingOption[] = LIGHTING_MODES.map(
  (mode) => kLightingOptions[mode]
);

export function lightingOption(
  mode: LightingMode
): LightingOption {
  return kLightingOptions[mode];
}
