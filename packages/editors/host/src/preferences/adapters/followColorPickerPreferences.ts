// Import Third-party Dependencies
import type { Preferences } from "@jolly-pixel/preferences";
import type { ColorPicker } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { COLOR_PICKER_PREFERENCES } from "../hostPreferences.ts";

export function followColorPickerPreferences(
  picker: Pick<typeof ColorPicker, "follow">,
  preferences: Preferences
): () => void {
  return picker.follow({
    values: () => preferences.values(COLOR_PICKER_PREFERENCES),
    update: (patch) => preferences.update(COLOR_PICKER_PREFERENCES, patch),
    watch: (listener) => preferences.watch(COLOR_PICKER_PREFERENCES, listener)
  });
}
