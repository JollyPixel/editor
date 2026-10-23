// Import Third-party Dependencies
import {
  KeyChord,
  type KeyboardLayoutStore
} from "@jolly-pixel/controls";
import type { Lantern } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import type { Preferences } from "../../preferences/store/Preferences.ts";
import type { PreferenceScope } from "../../preferences/scope/PreferenceScope.ts";

export interface ProvideTourKeysOptions {
  lantern: Pick<Lantern, "keys">;
  preferences: Preferences;
  scope: PreferenceScope;
  layout: Pick<KeyboardLayoutStore, "layout">;
  /**
   * @default scope.name
   */
  namespace?: string;
}

export function provideTourKeys(
  options: ProvideTourKeysOptions
): () => void {
  const {
    lantern,
    preferences,
    scope,
    layout,
    namespace = scope.name
  } = options;
  const actions = new Set(scope.keyBindings.flatMap(
    (group) => group.fields.map(([action]) => action)
  ));

  return lantern.keys.provide(namespace, (action) => {
    if (!actions.has(action)) {
      return undefined;
    }

    const bindings = scope.bindings(preferences.overrides(scope.name));
    const labels = (bindings.get(action) ?? []).flatMap((binding) => {
      try {
        return [KeyChord.from(binding).format({ layout: layout.layout })];
      }
      catch {
        return [];
      }
    });

    return [...new Set(labels)];
  });
}
