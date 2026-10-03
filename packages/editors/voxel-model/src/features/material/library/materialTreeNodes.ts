// Import Third-party Dependencies
import type { TreeNode } from "@jolly-pixel/ui";
import type { PeerMarkMap } from "@jolly-pixel/ui/network";
import type { ModelMaterialJSON } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { surfaceSwatch } from "../../../shared/materialSwatch.ts";
import { peerBadges } from "../../../shared/peerBadges.ts";
import { usageRowId } from "./usageRows.ts";

export interface MaterialUser {
  id: string;
  name: string;
}

export interface MaterialTreeSources {
  /** In library order. */
  materials: readonly ModelMaterialJSON[];
  /** Blocks by the material they use, in hierarchy order. */
  users: ReadonlyMap<string, readonly MaterialUser[]>;
  /** Peers editing each material. */
  marks: PeerMarkMap<string>;
  /** Peers selecting each block. */
  blockMarks: PeerMarkMap<string>;
}

export function toMaterialTreeNodes(
  sources: MaterialTreeSources
): TreeNode[] {
  return sources.materials.map((material) => {
    const badges = peerBadges(material.id, sources.marks);
    const users = sources.users.get(material.id) ?? [];

    return {
      id: material.id,
      label: material.name,
      renamable: true,
      swatch: {
        title: material.name,
        ...surfaceSwatch(material.surface)
      },
      detail: String(users.length),
      ...badges.length > 0 ? { badges } : {},
      ...users.length > 0 ?
        { children: users.map((user) => usageRow(user, sources.blockMarks)) } :
        {}
    };
  });
}

function usageRow(
  user: MaterialUser,
  blockMarks: PeerMarkMap<string>
): TreeNode {
  const badges = peerBadges(user.id, blockMarks);

  return {
    id: usageRowId(user.id),
    label: user.name,
    renamable: false,
    ...badges.length > 0 ? { badges } : {}
  };
}
