// Import Third-party Dependencies
import { MATERIAL_SLOT_COUNT } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  materialPropertiesSchema,
  MAX_TERRAIN_MATERIALS,
  TERRAIN_MATERIAL_ACTIONS
} from "../network/TerrainCommand.schema.ts";
import type {
  TerrainCommand,
  TerrainMaterialChanges,
  TerrainMaterialCommand,
  TerrainMaterialField
} from "../network/types.ts";
import type { TerrainImage } from "./TerrainDocument.ts";
import type {
  TerrainMaterials,
  TerrainMaterialsReader
} from "./TerrainMaterials.ts";

// CONSTANTS
export const TERRAIN_MATERIAL_FIELDS = Object.freeze(
  Object.keys(materialPropertiesSchema.def.shape) as TerrainMaterialField[]
);
const kMaterialActions = new Set<string>(TERRAIN_MATERIAL_ACTIONS);

export type TerrainMaterialWriteRef =
  | {
    readonly kind: "material";
    readonly id: string;
    readonly field: TerrainMaterialField | null;
  }
  | { readonly kind: "texture-size"; };

export function isMaterialCommand(
  command: TerrainCommand
): command is TerrainMaterialCommand {
  return kMaterialActions.has(command.action);
}

export function changedFields(
  changes: TerrainMaterialChanges
): TerrainMaterialField[] {
  return TERRAIN_MATERIAL_FIELDS.filter((field) => changes[field] !== undefined);
}

export function acceptsMaterialCommand(
  materials: TerrainMaterialsReader,
  command: TerrainMaterialCommand
): boolean {
  switch (command.action) {
    case "material-added":
      return materials.material(command.material.id) === undefined &&
        command.material.slot < MATERIAL_SLOT_COUNT &&
        materials.materialAt(command.material.slot) === undefined &&
        materials.size < MAX_TERRAIN_MATERIALS;
    case "material-updated":
      return materials.material(command.id) !== undefined &&
        changedFields(command.changes).length > 0;
    case "material-removed":
      return materials.material(command.id) !== undefined;
    case "texture-size-changed":
      return command.size !== materials.textureSize;
  }
}

export function applyMaterialCommand(
  materials: TerrainMaterials,
  command: TerrainMaterialCommand
): void {
  switch (command.action) {
    case "material-added":
      materials.add(command.material);
      break;
    case "material-updated":
      materials.update(command.id, command.changes);
      break;
    case "material-removed":
      materials.remove(command.id);
      break;
    case "texture-size-changed":
      materials.textureSize = command.size;
      break;
  }
}

export function invertMaterialCommand(
  materials: TerrainMaterialsReader,
  command: TerrainMaterialCommand
): TerrainCommand[] {
  switch (command.action) {
    case "material-added":
      return [{ action: "material-removed", id: command.material.id }];
    case "material-updated": {
      const material = materials.material(command.id);
      if (material === undefined) {
        return [];
      }

      const changes: TerrainMaterialChanges = {};
      for (const field of changedFields(command.changes)) {
        Object.assign(changes, { [field]: material[field] });
      }

      return [{ action: "material-updated", id: command.id, changes }];
    }
    case "material-removed": {
      const material = materials.material(command.id);

      return material === undefined ? [] : [{ action: "material-added", material }];
    }
    case "texture-size-changed":
      return [{ action: "texture-size-changed", size: materials.textureSize }];
  }
}

export function captureMaterialImage(
  materials: TerrainMaterialsReader,
  command: TerrainMaterialCommand
): TerrainImage {
  if (command.action === "texture-size-changed") {
    return { chunks: [], materials: [], textureSize: materials.textureSize };
  }

  const id = materialCommandId(command);

  return {
    chunks: [],
    materials: [{ id, material: materials.material(id) ?? null }],
    textureSize: null
  };
}

export function materialWriteRefs(
  command: TerrainMaterialCommand
): TerrainMaterialWriteRef[] {
  switch (command.action) {
    case "material-updated":
      return changedFields(command.changes).map((field) => {
        return { kind: "material", id: command.id, field };
      });
    case "texture-size-changed":
      return [{ kind: "texture-size" }];
    default: {
      const id = materialCommandId(command);

      return [null, ...TERRAIN_MATERIAL_FIELDS].map((field) => {
        return { kind: "material", id, field };
      });
    }
  }
}

function materialCommandId(
  command: Exclude<TerrainMaterialCommand, { action: "texture-size-changed"; }>
): string {
  return command.action === "material-added" ? command.material.id : command.id;
}
