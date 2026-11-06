// Import Third-party Dependencies
import {
  PORTS,
  defineScenarioConfig
} from "@jolly-pixel/e2e";

export default defineScenarioConfig({
  port: PORTS.voxelModel,
  command: "pnpm run dev:e2e"
});
