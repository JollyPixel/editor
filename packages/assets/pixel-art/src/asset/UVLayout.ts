// Import Third-party Dependencies
import {
  UVRegion,
  type UVRegionData
} from "@jolly-pixel/pixel-draw.renderer";

type WithoutIdentity<TRegion> = TRegion extends unknown ?
  Omit<TRegion, "id" | "name" | "color"> :
  never;

/**
 * A UV region without its identity: the geometry a document stores for a
 * region it owns while the texture only shows it.
 */
export type UVLayoutData = WithoutIdentity<UVRegionData>;

export interface UVRegionIdentity {
  id: string;
  name?: string;
  color: string;
}

export function uvLayoutOf(
  region: UVRegion
): UVLayoutData {
  const {
    id: _id,
    name: _name,
    color: _color,
    ...layout
  } = region.toJSON();

  return layout;
}

export function uvRegionOf(
  layout: UVLayoutData,
  identity: UVRegionIdentity
): UVRegion {
  return UVRegion.from({
    ...layout,
    ...identity
  });
}
