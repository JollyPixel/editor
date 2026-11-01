// Import Third-party Dependencies
import {
  PORTS,
  defineScenarioConfig
} from "@jolly-pixel/e2e";

export default defineScenarioConfig({
  port: PORTS.voxelMap,
  command: "pnpm run dev:e2e"
});
