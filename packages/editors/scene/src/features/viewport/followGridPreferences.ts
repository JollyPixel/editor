// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import type { Grid } from "@jolly-pixel/three";

// Import Internal Dependencies
import {
  SCENE_PREFERENCES,
  type ScenePreferences
} from "../../preferences.ts";

export type PreferenceGrid = Pick<Grid, "enabled" | "showAxes">;

export function followGridPreferences(
  grid: PreferenceGrid,
  preferences: Preferences,
  changed: () => void
): () => void {
  function apply(
    values: ScenePreferences
  ): void {
    grid.enabled = values.grid;
    grid.showAxes = values.axes;
  }

  apply(preferences.values(SCENE_PREFERENCES));

  return preferences.watch(SCENE_PREFERENCES, (values) => {
    apply(values);
    changed();
  });
}
