// Import Third-party Dependencies
import {
  DEFAULT_WEBSOCKET_PATH
} from "@jolly-pixel/network/transport/constants.ts";

export const PORTS = {
  pixelArt: 3000,
  ui: 3001,
  voxelMap: 3002,
  voxelModel: 3003,
  studio: 3004
} as const;

export function baseUrl(
  port: number
): string {
  return `http://localhost:${port}`;
}

export function socketUrl(
  port: number
): string {
  return `ws://localhost:${port}${DEFAULT_WEBSOCKET_PATH}`;
}
