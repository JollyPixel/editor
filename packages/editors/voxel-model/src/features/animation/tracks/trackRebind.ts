// Import Third-party Dependencies
import {
  buildBlockPath,
  type ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";
import { MenuSession } from "@jolly-pixel/ui";

export function rebindMenu(
  document: Pick<ModelDocument, "tree" | "remapAnimationTrack">,
  setId: string,
  path: string
): MenuSession {
  const { tree } = document;
  const options = [...tree.blocks()].map(({ id }) => {
    const target = buildBlockPath(tree, id);

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
