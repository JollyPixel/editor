export interface UVRegionData {
  id: string;
  label: string;
  /** Left edge, normalized [0, 1], origin top-left. */
  u: number;
  /** Top edge, normalized [0, 1], origin top-left. */
  v: number;
  width: number;
  height: number;
  /** CSS color used for the SVG overlay tint. */
  color: string;
}

export class UVRegion {
  id: string;
  label: string;
  u: number;
  v: number;
  width: number;
  height: number;
  color: string;

  constructor(
    data: UVRegionData
  ) {
    this.id = data.id;
    this.label = data.label;
    this.u = data.u;
    this.v = data.v;
    this.width = data.width;
    this.height = data.height;
    this.color = data.color;
  }

  /** Clamp all coordinates so region stays inside [0, 1]×[0, 1]. */
  clamp(): void {
    this.u = Math.max(0, Math.min(1, this.u));
    this.v = Math.max(0, Math.min(1, this.v));
    this.width = Math.max(0, Math.min(1 - this.u, this.width));
    this.height = Math.max(0, Math.min(1 - this.v, this.height));
  }

  /** Snap u, v, width, height to the nearest pixel boundary. */
  snapToPixel(
    texW: number,
    texH: number
  ): void {
    this.u = Math.round(this.u * texW) / texW;
    this.v = Math.round(this.v * texH) / texH;
    this.width = Math.round(this.width * texW) / texW;
    this.height = Math.round(this.height * texH) / texH;
  }

  toData(): UVRegionData {
    return {
      id: this.id,
      label: this.label,
      u: this.u,
      v: this.v,
      width: this.width,
      height: this.height,
      color: this.color
    };
  }

  fromData(
    data: UVRegionData
  ): void {
    this.id = data.id;
    this.label = data.label;
    this.u = data.u;
    this.v = data.v;
    this.width = data.width;
    this.height = data.height;
    this.color = data.color;
  }
}
