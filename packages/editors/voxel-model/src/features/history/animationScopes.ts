// Import Internal Dependencies
import {
  animationKey,
  type AnimationFocus,
  type AnimationKey
} from "../../state/index.ts";

// CONSTANTS
export const ANIMATION_LIBRARY = "library";

export type AnimationScope = typeof ANIMATION_LIBRARY | AnimationKey;

export interface OwnedAnimationSets {
  readonly owned: { readonly id: string; } | undefined;
}

export function animationScope(
  focus: AnimationFocus,
  sets: OwnedAnimationSets
): AnimationScope {
  const { setId, clipId } = focus;
  if (setId === null || (clipId === null && setId === sets.owned?.id)) {
    return ANIMATION_LIBRARY;
  }

  return animationKey(setId, clipId);
}
