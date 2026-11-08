// Import Third-party Dependencies
import type { SceneTreeReader } from "@jolly-pixel/asset.scene/client";
import { PeerMarks } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  HierarchyRows,
  type RowSources
} from "../../../src/features/hierarchy/HierarchyRows.ts";
import { createSceneComponents } from "../sceneComponents.ts";

export function readRows(
  tree: SceneTreeReader,
  live: RowSources["live"],
  sources: Partial<RowSources> = {}
): HierarchyRows {
  return HierarchyRows.read(tree, {
    marks: new PeerMarks(),
    components: createSceneComponents(),
    naming: { name: () => "Overworld" },
    live,
    ...sources
  });
}
