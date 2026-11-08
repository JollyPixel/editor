// Import Third-party Dependencies
import contributions from "virtual:jolly-pixel/contributions/scene";
import { contributedScenePackages } from "@jolly-pixel/editor.host/scene";

// Import Internal Dependencies
import {
  BUILT_IN_COMPONENTS,
  BUILT_IN_PACKAGE
} from "../components/builtInComponents.ts";
import { SceneComponents } from "../components/SceneComponents.ts";

// CONSTANTS
export const PROJECT_COMPONENTS = new SceneComponents([
  [BUILT_IN_PACKAGE, BUILT_IN_COMPONENTS],
  ...contributedScenePackages(contributions)
]);
