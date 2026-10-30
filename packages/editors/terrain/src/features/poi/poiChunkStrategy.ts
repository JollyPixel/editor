// Import Third-party Dependencies
import type {
  TerrainDocument,
  TerrainPreview
} from "@jolly-pixel/asset.terrain/client";
import { raycastTerrain } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TerrainHistory } from "../../shared/terrainHistory.ts";
import {
  MAX_AIM_DISTANCE,
  type ChunkDragStrategy
} from "../chunks/ChunkDragTool.ts";
import { surfaceTarget } from "../chunks/model/chunkTarget.ts";
import {
  PoiChunkDrag,
  type PoiChunkMode
} from "./model/PoiChunkDrag.ts";
import type { PoiSelection } from "./model/PoiSelection.ts";

export interface PoiChunkStrategyOptions {
  document: Pick<TerrainDocument, "terrain" | "pointsOfInterest" | "updatePointOfInterest">;
  preview: Pick<TerrainPreview, "terrain">;
  selection: Pick<PoiSelection, "selected" | "editing">;
  history: Pick<TerrainHistory, "open">;
  paused: () => boolean;
}

export function poiChunkStrategy(
  options: PoiChunkStrategyOptions
): ChunkDragStrategy {
  const { document, preview, selection } = options;

  return {
    enabled: () => selection.selected !== null && selection.editing && !options.paused(),
    aim: (ray, inverted) => {
      const mode: PoiChunkMode = inverted ? "remove" : "add";
      const surface = raycastTerrain(preview.terrain, ray, { maxDistance: MAX_AIM_DISTANCE, hitHoles: true });
      const target = surface === null ? null : surfaceTarget(document.terrain, surface);
      if (target === null) {
        return null;
      }

      const named = document.pointsOfInterest.pointOfInterest(selection.selected!)?.chunks
        .some(({ x, z }) => x === target.coord.x && z === target.coord.z) ?? false;

      return { target, mode, accepted: mode === "add" ? !named : named };
    },
    begin: ({ target, mode }) => new PoiChunkDrag(
      options,
      { id: selection.selected!, mode: mode as PoiChunkMode },
      target.point
    )
  };
}
