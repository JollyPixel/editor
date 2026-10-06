// Import Third-party Dependencies
import type { MaterialGroup } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kNoEmissive = "#000000";
const kFnvOffset = 0x811c9dc5;
const kFnvPrime = 0x01000193;
const kGoldenRatio = 0.618033988749895;

export class MaterialSwatch {
  static of(
    materialId: string,
    finish?: MaterialGroup
  ): MaterialSwatch {
    const hue = Math.round(((hashOf(materialId) * kGoldenRatio) % 1) * 360);
    const glows = finish !== undefined &&
      finish.emissive !== kNoEmissive &&
      finish.emissiveIntensity > 0;

    return new MaterialSwatch(
      `hsl(${hue} 65% 55%)`,
      glows ? finish.emissive : null
    );
  }

  readonly color: string;
  readonly glow: string | null;

  constructor(
    color: string,
    glow: string | null = null
  ) {
    this.color = color;
    this.glow = glow;

    Object.freeze(this);
  }

  get style(): string {
    return this.glow === null ?
      `background:${this.color}` :
      `background:${this.color};--material-glow:${this.glow}`;
  }
}

function hashOf(
  text: string
): number {
  let hash = kFnvOffset;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, kFnvPrime) >>> 0;
  }

  return hash;
}
