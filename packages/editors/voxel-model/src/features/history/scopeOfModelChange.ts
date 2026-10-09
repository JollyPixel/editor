// Import Third-party Dependencies
import type { ModelChange } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { EditorHistoryScope } from "./editorHistory.ts";
import {
  ANIMATION_LIBRARY,
  animationScope,
  type OwnedAnimationSets
} from "./animationScopes.ts";

export function scopeOfModelChange(
  { command }: Pick<ModelChange, "command">,
  sets: OwnedAnimationSets
): EditorHistoryScope | null {
  switch (command.action) {
    case "node-added":
    case "node-removed":
    case "node-renamed":
    case "node-moved":
    case "node-transformed":
      return "build";
    case "node-material-changed":
    case "material-added":
    case "material-folder-added":
    case "material-removed":
    case "material-moved":
    case "material-renamed":
    case "material-changed":
      return "material";
    case "animation-set-linked":
      return command.link.own === true ? null : ANIMATION_LIBRARY;
    case "animation-set-unlinked":
    case "animation-set-owned":
      return ANIMATION_LIBRARY;
    case "animation-binding-changed":
    case "animation-binding-cleared":
      return animationScope({ setId: command.id, clipId: null }, sets);
    case "node-uv-changed":
      return null;
  }
}
