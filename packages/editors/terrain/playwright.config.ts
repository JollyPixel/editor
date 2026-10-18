// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.terrain,
  command: "pnpm run dev:e2e",
  ciWorkers: 2,
  localWorkers: "50%",
  viewport: {
    width: 820,
    height: 540
  }
});
