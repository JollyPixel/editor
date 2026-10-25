// Import Internal Dependencies
import type {
  SceneEnvironmentField,
  SceneEnvironmentJSON
} from "../network/types.ts";

// CONSTANTS
export const SCENE_ENVIRONMENT_FIELDS: readonly SceneEnvironmentField[] = [
  "background",
  "environment",
  "fog"
];

export function createSceneEnvironment(): SceneEnvironmentJSON {
  return {
    background: null,
    environment: {
      kind: "none",
      intensity: 1
    },
    fog: {
      kind: "none"
    }
  };
}
