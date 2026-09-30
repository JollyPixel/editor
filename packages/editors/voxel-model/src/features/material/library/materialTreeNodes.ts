// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";
import type { MaterialEntryJSON } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { surfaceSwatch } from "../../../shared/materialSwatch.ts";
import { peerBadges } from "../../../shared/peerBadges.ts";

export interface MaterialTreeSources {
  /** In library order, parents anywhere in the list. */
  entries: readonly MaterialEntryJSON[];
  uses: ReadonlyMap<string, number>;
  marks: PeerMarkMap<string>;
}

export function toMaterialTreeNodes(
  sources: MaterialTreeSources
): TreeNode[] {
  const byParent = Map.groupBy(sources.entries, (entry) => entry.parentId);

  function build(
    parentId: string | null
  ): TreeNode[] {
    return (byParent.get(parentId) ?? []).map((entry) => {
      const badges = peerBadges(entry.id, sources.marks);
      const row: TreeNode = {
        id: entry.id,
        label: entry.name,
        renamable: true,
        ...badges.length > 0 ? { badges } : {}
      };
      if (entry.kind === "material") {
        return {
          ...row,
          swatch: {
            title: entry.name,
            ...surfaceSwatch(entry.surface)
          },
          detail: String(sources.uses.get(entry.id) ?? 0)
        };
      }

      const children = build(entry.id);

      return {
        ...row,
        icon: "folder",
        ...children.length > 0 ? { children } : {}
      };
    });
  }

  return build(null);
}
