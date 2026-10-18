// Import Third-party Dependencies
import type { VoxelTemplate } from "@jolly-pixel/voxel.renderer";
import {
  formatCount,
  type TreeBadge,
  type TreeNode
} from "@jolly-pixel/ui";

export function templateTreeNodes(
  templates: Iterable<VoxelTemplate>,
  drafts: ReadonlyMap<string, TreeBadge[]>
): TreeNode<string>[] {
  return Array.from(templates, (template): TreeNode<string> => {
    const count = formatCount(template.voxelCount, "voxel");
    const badges = drafts.get(template.id);

    return {
      id: template.id,
      label: template.name,
      icon: "template",
      detail: badges === undefined ? count : `${count} · draft`,
      ...badges !== undefined && badges.length > 0 ? { badges } : {},
      renamable: true,
      data: template.id
    };
  });
}
