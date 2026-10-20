// Import Third-party Dependencies
import type { TerrainReader } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { PeerBrushRings } from "../collaboration/PeerBrushRings.ts";
import { halfWeightDistance } from "../model/falloff.ts";
import type { SculptOptions } from "../model/SculptSettings.ts";
import type { GroundPoint } from "../model/StampSpacer.ts";
import {
  BrushRing,
  type BrushRingShape
} from "./BrushRing.ts";

export interface BrushCursorOptions {
  terrain: TerrainReader;
  rings: Pick<PeerBrushRings, "publishLocalRing">;
}

export class BrushCursor {
  readonly ring = new BrushRing();

  #terrain: TerrainReader;
  #rings: Pick<PeerBrushRings, "publishLocalRing">;
  #drawn = "";
  #published = "";

  constructor(
    options: BrushCursorOptions
  ) {
    this.#terrain = options.terrain;
    this.#rings = options.rings;
  }

  show(
    point: GroundPoint,
    { size, falloff }: Pick<SculptOptions, "size" | "falloff">
  ): boolean {
    const key = `${point.x},${point.z},${size},${falloff}`;
    if (key === this.#drawn) {
      return false;
    }

    const inner = halfWeightDistance(falloff);
    const shape: BrushRingShape = {
      x: point.x,
      z: point.z,
      radius: size,
      innerRadius: inner === null ? null : inner * size
    };
    this.ring.draw(this.#terrain, shape);
    this.#drawn = key;
    if (key !== this.#published) {
      this.#published = key;
      this.#rings.publishLocalRing(shape);
    }

    return true;
  }

  hide(): boolean {
    if (!this.ring.visible) {
      return false;
    }

    this.ring.visible = false;
    this.#drawn = "";
    this.#published = "";
    this.#rings.publishLocalRing(null);

    return true;
  }

  terrainChanged(): void {
    this.#drawn = "";
  }

  dispose(): void {
    this.ring.dispose();
  }
}
