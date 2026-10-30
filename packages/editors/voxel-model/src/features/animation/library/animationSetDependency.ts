// Import Third-party Dependencies
import {
  VOXEL_ANIMATION_EXTENSION,
  VOXEL_ANIMATION_KIND
} from "@jolly-pixel/asset.voxel-animation/client";
import type { EditorDependencyFormat } from "@jolly-pixel/editor.host";

export const ANIMATION_SET_DEPENDENCY: EditorDependencyFormat = {
  kind: VOXEL_ANIMATION_KIND,
  extension: VOXEL_ANIMATION_EXTENSION,
  folder: "animations/"
};
