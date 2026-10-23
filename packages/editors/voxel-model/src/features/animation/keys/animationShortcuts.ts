// Import Third-party Dependencies
import type { KeyBindingHandlers } from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { AnimationKeyer } from "./AnimationKeyer.ts";
import type { BlockSelectionStore } from "../../../state/index.ts";

export interface KeySelectedOptions {
  keyer: Pick<AnimationKeyer, "keyBlock">;
  selection: Pick<BlockSelectionStore, "selected">;
}

export function keySelectedBlock(
  options: KeySelectedOptions
): boolean {
  const { selected } = options.selection;

  return selected !== null && options.keyer.keyBlock(selected);
}

export function animationShortcuts(
  options: KeySelectedOptions
): KeyBindingHandlers<"animation.key"> {
  return {
    "animation.key": () => {
      keySelectedBlock(options);
    }
  };
}
