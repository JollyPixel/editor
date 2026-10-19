// Import Internal Dependencies
import type { Preferences } from "../store/Preferences.ts";
import type {
  PreferenceOverrides,
  PreferenceScope
} from "../scope/PreferenceScope.ts";

export interface FollowedKeyBindings {
  chordsBoundTo(
    action: string
  ): readonly string[];
  load(
    overrides: PreferenceOverrides
  ): void;
  subscribe(
    event: "change",
    listener: () => void
  ): () => void;
}

export function followKeyBindings(
  settings: FollowedKeyBindings,
  preferences: Preferences,
  scope: PreferenceScope
): () => void {
  const actions = scope.keyBindings.flatMap(
    (group) => group.fields.map(([action]) => action)
  );
  function save(): void {
    preferences.update(scope, Object.fromEntries(
      actions.map((action) => [action, settings.chordsBoundTo(action)])
    ));
  }

  settings.load(preferences.values(scope));
  save();
  const stopWatching = preferences.watch(
    scope,
    (values) => settings.load(values)
  );
  const stopSaving = settings.subscribe("change", save);

  return () => {
    stopWatching();
    stopSaving();
  };
}
