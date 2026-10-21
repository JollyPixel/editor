// Import Third-party Dependencies
import {
  PORTS,
  defineE2EConfig
} from "@jolly-pixel/e2e";

export default defineE2EConfig({
  port: PORTS.lantern,
  command: "pnpm run serve:e2e",
  reducedMotion: "reduce"
});
