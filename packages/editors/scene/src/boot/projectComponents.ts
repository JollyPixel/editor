// Import Third-party Dependencies
import contributions from "virtual:jolly-pixel/contributions/scene";

// Import Internal Dependencies
import {
  BUILT_IN_COMPONENTS,
  BUILT_IN_PACKAGE
} from "../components/builtInComponents.ts";
import { SceneComponents } from "../components/SceneComponents.ts";

// CONSTANTS
export const PROJECT_COMPONENTS = new SceneComponents([
  [BUILT_IN_PACKAGE, BUILT_IN_COMPONENTS],
  ...contributions.map(({ name, module }) => {
    if (module.SCENE_COMPONENTS === undefined) {
      throw new TypeError(
        `"${name}" declares "jollypixel.scene" but does not export "SCENE_COMPONENTS".`
      );
    }

    return [name, module.SCENE_COMPONENTS] as const;
  })
]);
