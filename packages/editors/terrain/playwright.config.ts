// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.terrain,
  command: "pnpm run dev:e2e",
  ciWorkers: 1,
  localWorkers: 1,
  viewport: {
    width: 820,
    height: 540
  },
  deviceScaleFactor: 0.5
});
