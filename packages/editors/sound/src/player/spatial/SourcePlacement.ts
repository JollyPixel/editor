// Import Third-party Dependencies
import { clamp } from "@jolly-pixel/utils";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { PlanePoint } from "./PlanePoint.ts";

// CONSTANTS
export const SOURCE_MOTIONS = ["still", "orbit", "flyby", "approach"] as const;
const kTurn = Math.PI * 2;
const kForward: PlanePoint = {
  x: 0,
  z: -1
};

export type SourceMotion = typeof SOURCE_MOTIONS[number];

export interface SourcePlacementSnapshot extends PlanePoint {
  readonly motion: SourceMotion;
}

export class SourcePlacement {
  static readonly schema = z.object({
    x: z.number(),
    z: z.number(),
    motion: z.enum(SOURCE_MOTIONS)
  });
  static readonly default = new SourcePlacement({
    x: 0,
    z: -2,
    motion: "still"
  });

  readonly x: number;
  readonly z: number;
  readonly motion: SourceMotion;

  constructor(
    snapshot: SourcePlacementSnapshot
  ) {
    this.x = snapshot.x;
    this.z = snapshot.z;
    this.motion = snapshot.motion;
  }

  distance(): number {
    return Math.hypot(this.x, this.z);
  }

  movedTo(
    point: PlanePoint
  ): SourcePlacement {
    return new SourcePlacement({
      x: point.x,
      z: point.z,
      motion: this.motion
    });
  }

  withMotion(
    motion: SourceMotion
  ): SourcePlacement {
    return new SourcePlacement({
      ...this.toJSON(),
      motion
    });
  }

  pointAt(
    progress: number,
    reach: number
  ): PlanePoint {
    const along = clamp(progress, 0, 1);
    switch (this.motion) {
      case "still":
        return this.#point();
      case "orbit": {
        const angle = kTurn * along;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        return {
          x: this.x * cos - this.z * sin,
          z: this.x * sin + this.z * cos
        };
      }
      case "flyby": {
        const { x, z } = this.#direction();
        const offset = reach * (2 * along - 1);

        return {
          x: this.x - z * offset,
          z: this.z + x * offset
        };
      }
      case "approach": {
        const { x, z } = this.#direction();
        const distance = this.distance();
        const span = Math.max(reach, distance);
        const length = span + (distance - span) * along;

        return {
          x: x * length,
          z: z * length
        };
      }
      default: {
        const unhandled: never = this.motion;
        throw new Error(`Unhandled source motion: ${String(unhandled)}`);
      }
    }
  }

  toJSON(): SourcePlacementSnapshot {
    return {
      x: this.x,
      z: this.z,
      motion: this.motion
    };
  }

  #point(): PlanePoint {
    return {
      x: this.x,
      z: this.z
    };
  }

  #direction(): PlanePoint {
    const distance = this.distance();

    return distance === 0 ?
      kForward :
      {
        x: this.x / distance,
        z: this.z / distance
      };
  }
}
