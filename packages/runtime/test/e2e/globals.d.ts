// Import Internal Dependencies
import type { RuntimeHarness } from "./app/main.ts";

declare global {
  interface Window {
    runtimeE2E: RuntimeHarness;
  }
}

export {};
