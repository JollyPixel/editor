// Import Internal Dependencies
import {
  layerPropertiesSchema,
  MAX_TERRAIN_LAYERS,
  TERRAIN_LAYER_SLOTS
} from "../network/TerrainCommand.schema.ts";
import type {
  TerrainCommand,
  TerrainLayerChanges,
  TerrainLayerCommand,
  TerrainLayerField
} from "../network/types.ts";
import type {
  TerrainLayers,
  TerrainLayersReader
} from "./TerrainLayers.ts";

// CONSTANTS
export const TERRAIN_LAYER_FIELDS = Object.freeze(
  Object.keys(layerPropertiesSchema.def.shape) as TerrainLayerField[]
);
const kLayerActions = new Set<string>([
  "layer-added",
  "layer-updated",
  "layer-removed",
  "texture-size-changed"
]);

export function isLayerCommand(
  command: TerrainCommand
): command is TerrainLayerCommand {
  return kLayerActions.has(command.action);
}

export function changedFields(
  changes: TerrainLayerChanges
): TerrainLayerField[] {
  return TERRAIN_LAYER_FIELDS.filter((field) => changes[field] !== undefined);
}

export function acceptsLayerCommand(
  layers: TerrainLayersReader,
  command: TerrainLayerCommand
): boolean {
  switch (command.action) {
    case "layer-added":
      return layers.layer(command.layer.id) === undefined &&
        command.layer.slot < TERRAIN_LAYER_SLOTS &&
        !layers.slotTaken(command.layer.slot) &&
        layers.size < MAX_TERRAIN_LAYERS;
    case "layer-updated":
      return layers.layer(command.id) !== undefined &&
        changedFields(command.changes).length > 0;
    case "layer-removed":
      return layers.layer(command.id) !== undefined;
    case "texture-size-changed":
      return command.size !== layers.textureSize;
  }
}

export function applyLayerCommand(
  layers: TerrainLayers,
  command: TerrainLayerCommand
): void {
  switch (command.action) {
    case "layer-added":
      layers.add(command.layer);
      break;
    case "layer-updated":
      layers.update(command.id, command.changes);
      break;
    case "layer-removed":
      layers.remove(command.id);
      break;
    case "texture-size-changed":
      layers.textureSize = command.size;
      break;
  }
}

export function invertLayerCommand(
  layers: TerrainLayersReader,
  command: TerrainLayerCommand
): TerrainCommand[] {
  switch (command.action) {
    case "layer-added":
      return [{ action: "layer-removed", id: command.layer.id }];
    case "layer-updated": {
      const layer = layers.layer(command.id);
      if (layer === undefined) {
        return [];
      }

      const changes: TerrainLayerChanges = {};
      for (const field of changedFields(command.changes)) {
        Object.assign(changes, { [field]: layer[field] });
      }

      return [{ action: "layer-updated", id: command.id, changes }];
    }
    case "layer-removed": {
      const layer = layers.layer(command.id);

      return layer === undefined ? [] : [{ action: "layer-added", layer }];
    }
    case "texture-size-changed":
      return [{ action: "texture-size-changed", size: layers.textureSize }];
  }
}
