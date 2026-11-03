// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.script,
  command: "pnpm run dev:e2e",
  viewport: {
    width: 900,
    height: 600
  }
});
