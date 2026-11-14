// Import Third-party Dependencies
import {
  PresenceChannel,
  type Room
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  OPEN_ASSETS_KEY,
  openAssetsSchema,
  type OpenAssets
} from "./openAssets.ts";

export function openAssetsChannel(
  room: Room
): PresenceChannel<OpenAssets> {
  return new PresenceChannel(room, {
    key: OPEN_ASSETS_KEY,
    decode: openAssetsSchema,
    equals: sameOpenAssets
  });
}

function sameOpenAssets(
  left: OpenAssets,
  right: OpenAssets
): boolean {
  return left.focused === right.focused &&
    left.open.length === right.open.length &&
    left.open.every((assetId, index) => assetId === right.open[index]);
}
