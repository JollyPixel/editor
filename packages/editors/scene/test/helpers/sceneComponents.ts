// Import Internal Dependencies
import {
  BUILT_IN_COMPONENTS,
  BUILT_IN_PACKAGE
} from "../../src/components/builtInComponents.ts";
import {
  SceneComponents,
  type NamedSceneComponentPackage
} from "../../src/components/SceneComponents.ts";

export function createSceneComponents(
  ...packages: NamedSceneComponentPackage[]
): SceneComponents {
  return new SceneComponents([
    [BUILT_IN_PACKAGE, BUILT_IN_COMPONENTS],
    ...packages
  ]);
}
