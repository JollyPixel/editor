// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.studio,
  command: "pnpm run dev:e2e",
  reuseExistingServer: false
});
