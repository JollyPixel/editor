// Import Third-party Dependencies
import { PIXEL_ART_CAPABILITIES } from "@jolly-pixel/asset.pixel-art/client";
import {
  CapabilityTable,
  type CapabilityName,
  type Grants
} from "@jolly-pixel/network/client";

export type PixelArtCapability = CapabilityName<typeof PIXEL_ART_CAPABILITIES>;

export type PixelArtAccess = Grants<PixelArtCapability>;

export const PIXEL_ART_CAPABILITY_TABLE = new CapabilityTable(
  PIXEL_ART_CAPABILITIES
);
