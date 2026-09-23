// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.voxelMap,
  command: "pnpm run dev:e2e",
  ciWorkers: 2,
  viewport: {
    width: 960,
    height: 540
  }
});
