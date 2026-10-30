// Import Third-party Dependencies
import type {
  TerrainDocument,
  TerrainPreview
} from "@jolly-pixel/asset.terrain/client";
import {
  raycastTerrain,
  type TerrainRay
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { TerrainHistory } from "../../shared/terrainHistory.ts";
import type { SculptSettings } from "../../state/SculptSettings.ts";
import {
  MAX_AIM_DISTANCE,
  type ChunkDragStrategy
} from "./ChunkDragTool.ts";
import {
  ChunkDrag,
  type ChunkMode
} from "./model/ChunkDrag.ts";
import {
  emptyGroundTarget,
  surfaceTarget,
  type ChunkTarget
} from "./model/chunkTarget.ts";

export interface ChunkToolStrategyOptions {
  document: Pick<
    TerrainDocument,
    "terrain" | "addChunk" | "removeChunk" | "changeTier" | "canAddChunk" | "canRemoveChunk"
  >;
  preview: Pick<TerrainPreview, "terrain">;
  settings: Pick<SculptSettings, "options">;
  history: Pick<TerrainHistory, "open">;
  paused: () => boolean;
}

export function chunkToolStrategy(
  options: ChunkToolStrategyOptions
): ChunkDragStrategy {
  const { document, preview, settings } = options;

  function findTarget(
    mode: ChunkMode,
    ray: TerrainRay
  ): ChunkTarget | null {
    const surface = raycastTerrain(preview.terrain, ray, { maxDistance: MAX_AIM_DISTANCE, hitHoles: true });
    if (mode !== "add") {
      return surface === null ? null : surfaceTarget(document.terrain, surface);
    }

    const ground = emptyGroundTarget(document.terrain, ray, MAX_AIM_DISTANCE);

    return ground === null || (surface !== null && surface.distance < ground.distance) ? null : ground;
  }

  function accepts(
    mode: ChunkMode,
    { coord }: ChunkTarget
  ): boolean {
    switch (mode) {
      case "add":
        return document.canAddChunk(coord.x, coord.z);
      case "remove":
        return document.canRemoveChunk(coord.x, coord.z);
      case "detail":
        return document.terrain.chunk(coord)?.tier !== settings.options.chunkTier;
    }
  }

  return {
    enabled: () => settings.options.tool === "chunks" && !options.paused(),
    aim: (ray, inverted) => {
      const { chunkMode } = settings.options;
      const mode = inverted ? swapped(chunkMode) : chunkMode;
      const target = findTarget(mode, ray);

      return target === null ? null : { target, mode, accepted: accepts(mode, target) };
    },
    begin: ({ target, mode }) => new ChunkDrag(
      options,
      { mode, tier: settings.options.chunkTier },
      target.point
    )
  };
}

function swapped(
  mode: ChunkMode
): ChunkMode {
  switch (mode) {
    case "add":
      return "remove";
    case "remove":
      return "add";
    case "detail":
      return "detail";
  }
}
