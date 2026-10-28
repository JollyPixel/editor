// Import Third-party Dependencies
import type {
  TerrainDocument,
  TerrainPreview
} from "@jolly-pixel/asset.terrain/client";
import {
  CHUNK_SAMPLES,
  ChunkCoord,
  SPLAT_TEXELS
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { MaterialSelection } from "../materials/model/MaterialSelection.ts";
import type { BrushToolHandler } from "../sculpt/model/BrushToolHandler.ts";
import {
  PaintStroke,
  type PaintStrokeOptions
} from "./model/PaintStroke.ts";

// CONSTANTS
const kTexelsPerMetre = SPLAT_TEXELS / CHUNK_SAMPLES;

export interface PaintToolOptions extends PaintStrokeOptions {
  document: Pick<TerrainDocument, "terrain" | "materials" | "patchSplat">;
  preview: Pick<TerrainPreview, "terrain" | "writeSplat">;
  selection: Pick<MaterialSelection, "selected" | "select">;
}

export function paintTool(
  options: PaintToolOptions
): BrushToolHandler {
  const { document, preview, selection } = options;

  return {
    begin: ({ point, lower }) => {
      const material = selection.selected === null ?
        undefined :
        document.materials.material(selection.selected);

      return lower || material === undefined ?
        null :
        new PaintStroke(options, { point, slot: material.slot });
    },
    pick: ({ point }) => {
      const chunk = preview.terrain.chunk(ChunkCoord.containing(point.x, point.z));
      if (chunk === undefined) {
        return;
      }

      const origin = chunk.coord.originSample;
      const texelX = Math.min(Math.floor((point.x - origin.x) * kTexelsPerMetre), SPLAT_TEXELS - 1);
      const texelZ = Math.min(Math.floor((point.z - origin.z) * kTexelsPerMetre), SPLAT_TEXELS - 1);
      const material = document.materials.materialAt(chunk.splat.dominantSlot(texelX, texelZ));
      if (material !== undefined) {
        selection.select(material.id);
      }
    }
  };
}
