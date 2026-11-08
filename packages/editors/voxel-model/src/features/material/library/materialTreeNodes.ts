// Import Third-party Dependencies
import type {
  PeerMarks,
  TreeNode
} from "@jolly-pixel/ui";
import type { ModelMaterialJSON } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { surfaceSwatch } from "../materialSwatch.ts";
import { usageRowId } from "./usageRows.ts";

export interface MaterialUser {
  id: string;
  name: string;
}

export interface MaterialTreeSources {
  /**
   * In library order.
   */
  materials: readonly ModelMaterialJSON[];
  /**
   * Blocks by the material they use, in hierarchy order.
   */
  users: ReadonlyMap<string, readonly MaterialUser[]>;
  /**
   * Peers editing each material.
   */
  marks: PeerMarks<string>;
  /**
   * Peers selecting each block.
   */
  blockMarks: PeerMarks<string>;
}

export function toMaterialTreeNodes(
  sources: MaterialTreeSources
): TreeNode[] {
  return sources.materials.map((material) => {
    const badges = sources.marks.badges(material.id);
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
  blockMarks: PeerMarks<string>
): TreeNode {
  const badges = blockMarks.badges(user.id);

  return {
    id: usageRowId(user.id),
    label: user.name,
    renamable: false,
    ...badges.length > 0 ? { badges } : {}
  };
}
