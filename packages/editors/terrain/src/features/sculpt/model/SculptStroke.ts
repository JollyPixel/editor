// Import Third-party Dependencies
import type {
  TerrainPreview,
  TerrainStroke
} from "@jolly-pixel/asset.terrain/client";
import type { OpenStep } from "@jolly-pixel/history";
import type { TerrainReader } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import { stampStrength } from "../../brush/model/brushRate.ts";
import type { BrushPress } from "../../brush/model/BrushToolHandler.ts";
import { CommitCadence } from "../../brush/model/CommitCadence.ts";
import type {
  SculptOptions,
  SculptSettings
} from "../../../state/SculptSettings.ts";
import {
  sculptStamp,
  type SculptStamp,
  type SculptTool
} from "./sculptStamp.ts";
import {
  StampSpacer,
  type GroundPoint
} from "../../brush/model/StampSpacer.ts";

export interface SculptStrokeOptions {
  preview: Pick<TerrainPreview, "beginStroke">;
  history: Pick<TerrainHistory, "open">;
  settings: Pick<SculptSettings, "options">;
}

export interface StrokePress extends BrushPress {
  readonly tool: SculptTool;
}

export class SculptStroke {
  #terrain: TerrainReader;
  #settings: Pick<SculptSettings, "options">;
  #step: OpenStep;
  #preview: TerrainStroke;
  #spacer: StampSpacer;
  #cadence = new CommitCadence();
  #tool: SculptTool;
  #lower: boolean;
  #target: number;

  constructor(
    options: SculptStrokeOptions,
    press: StrokePress
  ) {
    const { flattenTarget, flattenHeight } = options.settings.options;
    this.#settings = options.settings;
    this.#preview = options.preview.beginStroke();
    this.#step = options.history.open(TERRAIN_HISTORY_SCOPE, "Sculpt");
    this.#terrain = this.#preview.terrain;
    this.#spacer = new StampSpacer(press.point);
    this.#tool = press.tool;
    this.#lower = press.lower;
    this.#target = flattenTarget === "fixed" ? flattenHeight : press.height;
  }

  update(
    point: GroundPoint | null,
    elapsed: number
  ): void {
    if (point !== null) {
      const { size, spacing } = this.#settings.options;
      const centres = this.#spacer.moveTo(point, size * spacing);
      this.#stamp(centres.length === 0 ? [point] : centres, elapsed);
    }
    this.#cadence.tick(elapsed);
    if (this.#cadence.due) {
      this.#commit();
    }
  }

  end(): void {
    this.#preview.end();
    this.#cadence.reset();
    this.#step.commit();
  }

  #commit(): void {
    this.#preview.commit();
    this.#cadence.reset();
  }

  #stamp(
    centres: readonly GroundPoint[],
    elapsed: number
  ): void {
    const options = this.#settings.options;
    const strength = stampStrength(
      this.#tool,
      options.strength,
      elapsed,
      centres.length
    );
    for (const centre of centres) {
      const patches = sculptStamp(
        this.#terrain,
        this.#stampAt(centre, strength, options)
      );
      this.#preview.write(patches);
      this.#cadence.touch(patches.map(({ tile }) => tile));
    }
  }

  #stampAt(
    { x, z }: GroundPoint,
    strength: number,
    options: Readonly<SculptOptions>
  ): SculptStamp {
    const footprint = {
      x,
      z,
      radius: options.size,
      strength,
      falloff: options.falloff
    };
    switch (this.#tool) {
      case "raise":
        return {
          ...footprint,
          tool: "raise",
          lift: this.#lower ? -options.size : options.size
        };
      case "flatten":
        return {
          ...footprint,
          tool: "flatten",
          target: this.#target
        };
      case "smooth":
        return {
          ...footprint,
          tool: "smooth"
        };
      case "terrace":
        return {
          ...footprint,
          tool: "terrace",
          step: options.terraceStep,
          sharpness: options.terraceSharpness
        };
    }
  }
}
