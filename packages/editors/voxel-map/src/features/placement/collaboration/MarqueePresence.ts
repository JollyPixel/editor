// Import Internal Dependencies
import {
  CellRegion,
  type CellRegionJSON
} from "../CellRegion.ts";

export interface MarqueePresenceJSON {
  marquee: {
    layerName: string;
    region: CellRegionJSON;
  };
}

export class MarqueePresence {
  static parse(
    value: unknown
  ): MarqueePresence | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const marquee = Reflect.get(value, "marquee");
    if (typeof marquee !== "object" || marquee === null) {
      return null;
    }

    const layerName = Reflect.get(marquee, "layerName");
    const region = CellRegion.parse(Reflect.get(marquee, "region"));
    if (
      typeof layerName !== "string" ||
      layerName.length === 0 ||
      region === null
    ) {
      return null;
    }

    return new MarqueePresence(layerName, region);
  }

  readonly layerName: string;
  readonly region: CellRegion;

  constructor(
    layerName: string,
    region: CellRegion
  ) {
    this.layerName = layerName;
    this.region = region;

    Object.freeze(this);
  }

  equals(
    other: MarqueePresence | null
  ): boolean {
    return other !== null &&
      other.layerName === this.layerName &&
      other.region.equals(this.region);
  }

  toJSON(): MarqueePresenceJSON {
    return {
      marquee: {
        layerName: this.layerName,
        region: this.region.toJSON()
      }
    };
  }
}
