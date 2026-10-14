// Import Third-party Dependencies
import type {
  VoxelTemplate,
  VoxelTemplates
} from "@jolly-pixel/voxel.renderer";

export type TemplatePreviewView =
  | { kind: "hidden"; }
  | { kind: "empty"; }
  | { kind: "template"; template: VoxelTemplate; };

export function resolveTemplatePreview(
  templates: Pick<VoxelTemplates, "size" | "get">,
  selectedId: string | null
): TemplatePreviewView {
  if (templates.size === 0) {
    return { kind: "hidden" };
  }

  const template = selectedId === null ?
    undefined :
    templates.get(selectedId);

  return template === undefined ?
    { kind: "empty" } :
    {
      kind: "template",
      template
    };
}
