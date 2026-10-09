// Import Third-party Dependencies
import {
  blockPathOf,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { MenuSession } from "../../../shared/menu/MenuSession.ts";

export function rebindMenu(
  document: Pick<ModelDocument, "tree" | "remapAnimationTrack">,
  setId: string,
  path: string
): MenuSession {
  const { tree } = document;
  const options = [...tree.blocks()].map(({ id }) => {
    const target = blockPathOf(tree, id);

    return { label: target, value: target };
  });

  return MenuSession.picker(
    options,
    "The model has no block",
    (target) => {
      document.remapAnimationTrack(setId, path, target);
    }
  );
}
