// Import Third-party Dependencies
import type {
  VoxelTemplate,
  VoxelTemplates
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { TemplatePreviewMode } from "../../state/TemplatePreviewStore.ts";

export type TemplatePreviewView =
  | { kind: "hidden"; }
  | { kind: "disabled"; }
  | { kind: "empty"; }
  | { kind: "template"; template: VoxelTemplate; };

export function resolveTemplatePreview(
  templates: Pick<VoxelTemplates, "size" | "get">,
  selectedId: string | null,
  mode: TemplatePreviewMode
): TemplatePreviewView {
  if (templates.size === 0) {
    return { kind: "hidden" };
  }
  if (mode === "disabled") {
    return { kind: "disabled" };
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
