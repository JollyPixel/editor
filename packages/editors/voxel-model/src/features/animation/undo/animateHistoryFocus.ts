// Import Third-party Dependencies
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { AnimationFocusStore } from "../../../state/index.ts";
import {
  animationScope,
  type FocusedHistory
} from "../../history/index.ts";
import { combineReleases } from "../../../shared/combineReleases.ts";
import type { AnimationLibrary } from "../library/AnimationLibrary.ts";

export interface AnimateHistoryFocusOptions {
  document: Pick<ModelDocument, "tree">;
  animations: Pick<AnimationLibrary, "focusName" | "subscribe">;
  animationFocus: Pick<AnimationFocusStore, "focus" | "subscribe">;
}

export function animateHistoryFocus(
  options: AnimateHistoryFocusOptions
): FocusedHistory {
  const { document, animations, animationFocus } = options;

  return {
    get focused() {
      const { focus } = animationFocus;

      return {
        scope: animationScope(focus, document.tree.animationSets),
        name: animations.focusName(focus)
      };
    },
    subscribeFocus(listener) {
      return combineReleases([
        animationFocus.subscribe("change", listener),
        animations.subscribe("change", listener)
      ]);
    }
  };
}
