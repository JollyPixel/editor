// Import Third-party Dependencies
import type { VoxelTemplate } from "@jolly-pixel/voxel.renderer";
import {
  formatCount,
  type TreeNode
} from "@jolly-pixel/ui";

export function templateTreeNodes(
  templates: Iterable<VoxelTemplate>
): TreeNode<string>[] {
  return Array.from(templates, (template): TreeNode<string> => {
    return {
      id: template.id,
      label: template.name,
      icon: "template",
      detail: formatCount(template.voxelCount, "voxel"),
      renamable: true,
      data: template.id
    };
  });
}
