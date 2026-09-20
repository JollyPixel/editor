// Import Third-party Dependencies
import {
  DEFAULT_WEBSOCKET_PATH
} from "@jolly-pixel/network/transport/constants.ts";

// CONSTANTS
export const E2E_PORT = 3003;
export const BASE_URL = `http://localhost:${E2E_PORT}`;
export const SOCKET_URL = `ws://localhost:${E2E_PORT}${DEFAULT_WEBSOCKET_PATH}`;
export const WORKER_COUNT = 4;
export const CI_WORKER_COUNT = 2;
