// Import Third-party Dependencies
import type {
  VoxelCoord,
  VoxelHistory,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { showConfirm } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { TemplateStore } from "./TemplateStore.ts";

export type TemplateWorld = Pick<VoxelWorld, "templates">;

export function saveLayerAsTemplate(
  world: TemplateWorld,
  templates: TemplateStore,
  layerName: string
): string | null {
  const template = world.templates.createFromLayer(layerName, {
    name: layerName
  });
  if (template === undefined) {
    return null;
  }
  templates.selected = template.id;

  return template.id;
}

export function renameTemplate(
  world: TemplateWorld,
  templateId: string,
  name: string
): boolean {
  const trimmed = name.trim();
  if (trimmed === "") {
    return false;
  }

  return world.templates.update(templateId, { name: trimmed });
}

export async function removeTemplate(
  world: TemplateWorld,
  templateId: string
): Promise<boolean> {
  const template = world.templates.get(templateId);
  if (template === undefined) {
    return false;
  }

  const confirmed = await showConfirm({
    title: "Delete template",
    message: `Delete "${template.name}"? Voxels already placed stay in their layers.`,
    confirmLabel: "Delete",
    icon: "trash",
    danger: true
  });

  return confirmed && world.templates.remove(templateId);
}

export function beginTemplatePlacement(
  world: TemplateWorld,
  templates: TemplateStore,
  templateId: string,
  position: VoxelCoord
): boolean {
  if (world.templates.get(templateId) === undefined) {
    return false;
  }
  templates.beginPlacement(templateId, position);

  return true;
}

export function commitTemplatePlacement(
  world: TemplateWorld,
  history: Pick<VoxelHistory, "begin" | "commit">,
  templates: TemplateStore,
  layerName: string | null
): boolean {
  const { placement } = templates;
  if (placement === null || layerName === null) {
    return false;
  }

  history.begin();
  let placed = false;
  try {
    placed = world.templates.place(placement.templateId, {
      layerName,
      position: placement.position,
      transform: placement.transform
    });
  }
  finally {
    history.commit();
  }
  if (placed) {
    templates.endPlacement();
  }

  return placed;
}
