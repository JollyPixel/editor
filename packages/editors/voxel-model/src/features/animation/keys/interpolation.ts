// Import Third-party Dependencies
import type { JollyOption } from "@jolly-pixel/ui";
import {
  ANIMATION_INTERPOLATIONS,
  type AnimationInterpolation
} from "@jolly-pixel/asset.voxel-animation/client";

// CONSTANTS
const kLabels: Readonly<Record<AnimationInterpolation, string>> = {
  step: "Step",
  linear: "Linear",
  smooth: "Smooth"
};

export const INTERPOLATION_OPTIONS: JollyOption<AnimationInterpolation>[] = ANIMATION_INTERPOLATIONS.map(
  (value) => {
    return { value, label: kLabels[value] };
  }
);
