// Import Third-party Dependencies
import type { TerrainHit } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import type { GroundPoint } from "./StampSpacer.ts";

export interface BrushPress {
  readonly point: GroundPoint;
  readonly height: number;
  readonly lower: boolean;
}

export interface BrushStroke {
  update(point: GroundPoint | null, elapsed: number, inverted: boolean): void;
  end(): void;
}

export interface BrushToolHandler {
  begin(press: BrushPress): BrushStroke | null;
  pick?(hit: TerrainHit): void;
  hitsHoles?: boolean;
}
