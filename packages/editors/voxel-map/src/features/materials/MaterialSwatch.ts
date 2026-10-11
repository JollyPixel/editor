// Import Third-party Dependencies
import {
  goldenAngleColor,
  hashKey
} from "@jolly-pixel/color";
import type { MaterialGroup } from "@jolly-pixel/voxel.renderer";

// CONSTANTS
const kNoEmissive = "#000000";
const kDerivedColor = {
  saturation: 0.65,
  lightness: 0.55
};

export class MaterialSwatch {
  static derivedColor(
    materialId: string
  ): string {
    return goldenAngleColor(hashKey(materialId), kDerivedColor);
  }

  static fromMaterial(
    materialId: string,
    finish?: MaterialGroup
  ): MaterialSwatch {
    const glows = finish !== undefined &&
      finish.emissive !== kNoEmissive &&
      finish.emissiveIntensity > 0;

    return new MaterialSwatch(
      finish?.swatch ?? MaterialSwatch.derivedColor(materialId),
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
