// Import Third-party Dependencies
import type { AnimationChange } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  animationScope,
  type AnimationScope,
  type OwnedAnimationSets
} from "../../history/index.ts";

export function scopeOfAnimationChange(
  { command }: Pick<AnimationChange, "command">,
  setId: string,
  sets: OwnedAnimationSets
): AnimationScope {
  switch (command.action) {
    case "key-set":
    case "key-removed":
    case "track-removed":
    case "track-renamed":
      return animationScope({ setId, clipId: command.clipId }, sets);
    case "clip-changed": {
      const renamed = command.patch.name !== undefined;

      return animationScope({ setId, clipId: renamed ? null : command.id }, sets);
    }
    case "rig-renamed":
    case "clip-added":
    case "clip-removed":
    case "clip-moved":
      return animationScope({ setId, clipId: null }, sets);
  }
}
