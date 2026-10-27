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
import { stampStrength } from "../../sculpt/model/brushRate.ts";
import { CommitCadence } from "../../sculpt/model/CommitCadence.ts";
import type { SculptSettings } from "../../sculpt/model/SculptSettings.ts";
import {
  StampSpacer,
  type GroundPoint
} from "../../sculpt/model/StampSpacer.ts";
import {
  paintStamp,
  type PaintTiles
} from "./paintStamp.ts";

export interface PaintStrokeOptions {
  document: Pick<TerrainDocument, "terrain" | "patchSplat">;
  preview: Pick<TerrainPreview, "writeSplat">;
  history: Pick<TerrainHistory, "open">;
  settings: Pick<SculptSettings, "options">;
}

export interface PaintPress {
  readonly point: GroundPoint;
  readonly slot: number;
}

export class PaintStroke {
  #options: PaintStrokeOptions;
  #step: OpenStep;
  #spacer: StampSpacer;
  #cadence = new CommitCadence();
  #slot: number;
  #tiles: PaintTiles = new Map();
  #pending = new Map<TileKey, TileCoord>();
  #ended = false;

  constructor(
    options: PaintStrokeOptions,
    press: PaintPress
  ) {
    this.#options = options;
    this.#step = options.history.open(TERRAIN_HISTORY_SCOPE, "Paint");
    this.#spacer = new StampSpacer(press.point);
    this.#slot = press.slot;
  }

  update(
    point: GroundPoint | null,
    elapsed: number
  ): void {
    if (this.#ended) {
      return;
    }
    if (point !== null) {
      const { size, spacing } = this.#options.settings.options;
      const centres = this.#spacer.moveTo(point, size * spacing);
      this.#stamp(centres.length === 0 ? [point] : centres, elapsed);
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
    elapsed: number
  ): void {
    const { document, preview, settings } = this.#options;
    const { size, falloff, paintStrength } = settings.options;
    const strength = stampStrength("paint", paintStrength, elapsed, centres.length);
    const touched = new Map<TileKey, TileCoord>();
    for (const { x, z } of centres) {
      const tiles = paintStamp(document.terrain, this.#tiles, {
        x,
        z,
        radius: size,
        strength,
        falloff,
        slot: this.#slot
      });
      for (const tile of tiles) {
        touched.set(tile.key, tile);
        this.#pending.set(tile.key, tile);
      }
    }
    if (touched.size > 0) {
      preview.writeSplat([...touched.keys()].map((key) => this.#tiles.get(key)!));
      this.#cadence.touch(touched.values());
    }
  }

  #commit(): void {
    const patches = [...this.#pending.keys()].map((key) => this.#tiles.get(key)!);
    this.#pending.clear();
    this.#cadence.reset();
    if (patches.length > 0) {
      this.#options.document.patchSplat(patches);
    }
  }
}
