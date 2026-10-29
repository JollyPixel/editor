// Import Third-party Dependencies
import type {
  TerrainDocument,
  TerrainPreview
} from "@jolly-pixel/asset.terrain/client";
import type { OpenStep } from "@jolly-pixel/history";
import type {
  TileCoord,
  TileKey
} from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import type { BrushStroke } from "../../sculpt/model/BrushToolHandler.ts";
import { CommitCadence } from "../../sculpt/model/CommitCadence.ts";
import type { SculptSettings } from "../../sculpt/model/SculptSettings.ts";
import {
  StampSpacer,
  type GroundPoint
} from "../../sculpt/model/StampSpacer.ts";
import {
  holeStamp,
  type HoleTiles
} from "./holeStamp.ts";

export interface HoleStrokeOptions {
  document: Pick<TerrainDocument, "terrain" | "patchHoles">;
  preview: Pick<TerrainPreview, "writeHoles">;
  history: Pick<TerrainHistory, "open">;
  settings: Pick<SculptSettings, "options">;
}

export class HoleStroke implements BrushStroke {
  #options: HoleStrokeOptions;
  #step: OpenStep;
  #spacer: StampSpacer;
  #cadence = new CommitCadence();
  #tiles: HoleTiles = new Map();
  #pending = new Map<TileKey, TileCoord>();
  #ended = false;

  constructor(
    options: HoleStrokeOptions,
    point: GroundPoint
  ) {
    this.#options = options;
    this.#step = options.history.open(TERRAIN_HISTORY_SCOPE, "Edit holes");
    this.#spacer = new StampSpacer(point);
  }

  update(
    point: GroundPoint | null,
    elapsed: number,
    inverted = false
  ): void {
    if (this.#ended) {
      return;
    }
    if (point !== null) {
      const { size, spacing } = this.#options.settings.options;
      const centres = this.#spacer.moveTo(point, size * spacing);
      this.#stamp(centres.length === 0 ? [point] : centres, inverted);
    }
    this.#cadence.tick(elapsed);
    if (this.#cadence.due) {
      this.#commit();
    }
  }

  end(): void {
    if (this.#ended) {
      return;
    }

    this.#ended = true;
    this.#commit();
    this.#step.commit();
  }

  #stamp(
    centres: readonly GroundPoint[],
    inverted: boolean
  ): void {
    const { document, preview, settings } = this.#options;
    const { size, holeMode } = settings.options;
    const cut = (holeMode === "cut") !== inverted;
    const changed = new Map<TileKey, TileCoord>();
    for (const { x, z } of centres) {
      const tiles = holeStamp(document.terrain, this.#tiles, {
        x,
        z,
        radius: size,
        mode: cut ? "cut" : "fill"
      });
      for (const tile of tiles) {
        changed.set(tile.key, tile);
        this.#pending.set(tile.key, tile);
      }
    }
    if (changed.size > 0) {
      preview.writeHoles([...changed.keys()].map((key) => this.#tiles.get(key)!));
      this.#cadence.touch(changed.values());
    }
  }

  #commit(): void {
    const patches = [...this.#pending.keys()].map((key) => this.#tiles.get(key)!);
    this.#pending.clear();
    this.#cadence.reset();
    if (patches.length > 0) {
      this.#options.document.patchHoles(patches);
    }
  }
}
