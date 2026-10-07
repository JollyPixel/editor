// Import Third-party Dependencies
import type { ModelChange } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type { EditorTab } from "../../state/index.ts";

export function scopeOfModelChange(
  change: ModelChange
): EditorTab | null {
  const { command } = change;
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
      return command.link.own === true ? null : "animate";
    case "animation-set-unlinked":
    case "animation-set-owned":
    case "animation-binding-changed":
    case "animation-binding-cleared":
      return "animate";
    case "node-uv-changed":
      return null;
  }
}
