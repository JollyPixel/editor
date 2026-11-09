// Import Third-party Dependencies
import { ModelDefinition } from "@jolly-pixel/engine";
import type { RuntimeComponentPackage } from "@jolly-pixel/runtime";

// CONSTANTS
export const MODEL_DEFINITION = new ModelDefinition();

export const RUNTIME_COMPONENTS: RuntimeComponentPackage = {
  definitions: [MODEL_DEFINITION]
};
