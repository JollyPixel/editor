// Import Third-party Dependencies
import type { TerrainPreview } from "@jolly-pixel/asset.terrain/client";
import { surfaceHeight } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import {
  TERRAIN_HISTORY_SCOPE,
  type TerrainHistory
} from "../../../shared/terrainHistory.ts";
import type {
  BrushPress,
  BrushStroke,
  StrokeSegment
} from "../../brush/model/BrushToolHandler.ts";
import {
  rampStamp,
  type RampEnd
} from "./rampStamp.ts";
import type { SculptSettings } from "../../../state/SculptSettings.ts";
import type { GroundPoint } from "../../brush/model/StampSpacer.ts";

export interface RampStrokeOptions {
  preview: Pick<TerrainPreview, "beginStroke">;
  history: Pick<TerrainHistory, "open">;
  settings: Pick<SculptSettings, "options">;
}

export class RampStroke implements BrushStroke {
  #options: RampStrokeOptions;
  #from: RampEnd;
  #to: GroundPoint;
  #ended = false;

  constructor(
    options: RampStrokeOptions,
    { point, height }: BrushPress
  ) {
    this.#options = options;
    this.#from = { ...point, height };
    this.#to = point;
  }

  get segment(): StrokeSegment | null {
    return this.#ended ? null : { from: this.#from, to: this.#to };
  }

  update(
    point: GroundPoint | null
  ): void {
    if (point !== null && !this.#ended) {
      this.#to = point;
    }
  }

  cancel(): void {
    this.#ended = true;
  }

  end(): void {
    if (this.#ended) {
      return;
    }

    this.#ended = true;
    const from = this.#from;
    const to = this.#to;
    if (from.x === to.x && from.z === to.z) {
      return;
    }

    const { preview, history, settings } = this.#options;
    const { size, strength, falloff } = settings.options;
    const step = history.open(TERRAIN_HISTORY_SCOPE, "Ramp");
    const stroke = preview.beginStroke();
    const height = surfaceHeight(stroke.terrain, to.x, to.z) ?? from.height;
    stroke.write(rampStamp(stroke.terrain, {
      from,
      to: { ...to, height },
      radius: size,
      strength,
      falloff
    }));
    stroke.end();
    step.commit();
  }
}
