// Import Third-party Dependencies
import {
  animationFootprint,
  type AnimationChange
} from "@jolly-pixel/asset.voxel-animation/client";

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
  const { clip } = animationFootprint(command);
  const scoped = clip !== null && (
    clip.content ||
    (command.action === "clip-changed" && command.patch.name === undefined)
  );

  return animationScope({ setId, clipId: scoped ? clip.id : null }, sets);
}
