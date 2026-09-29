// Import Third-party Dependencies
import type { VoxelTemplate } from "@jolly-pixel/voxel.renderer";
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { formatCount } from "../../shared/format.ts";

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
