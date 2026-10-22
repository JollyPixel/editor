// Import Third-party Dependencies
import {
  KeyBindingSettings,
  type KeyBindingDefaults
} from "@jolly-pixel/controls";

// Import Internal Dependencies
import type { Preferences } from "../store/Preferences.ts";
import type { PreferenceScope } from "../scope/PreferenceScope.ts";
import type { KeyBindingFields } from "../scope/defineKeyBindings.ts";

export function followKeyBindings<TAction extends string>(
  preferences: Preferences,
  scope: PreferenceScope<KeyBindingFields<TAction>>,
  onDropped?: (message: string) => void
): KeyBindingSettings<TAction> {
  const settings = new KeyBindingSettings({
    defaults: scope.defaults as KeyBindingDefaults<TAction>,
    overrides: preferences.values(scope),
    onDropped
  });
  function save(): void {
    preferences.update(scope, Object.fromEntries(
      settings.keyBindings.actions.map(
        (action) => [action, settings.chordsBoundTo(action)]
      )
    ));
  }

  save();
  preferences.watch(scope, (values) => settings.load(values));
  settings.subscribe("change", save);

  return settings;
}
