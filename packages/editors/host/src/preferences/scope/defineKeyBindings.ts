// Import Internal Dependencies
import type { ChordPreference } from "./PreferenceField.ts";
import { PreferenceScope } from "./PreferenceScope.ts";

export interface KeyBindingAction {
  label: string;
  /**
   * Heading the action is listed under on the Keybindings page.
   */
  group?: string;
}

export interface KeyBindingScopeDefinition<TAction extends string> {
  name: string;
  /**
   * Title of the scope's group on the Keybindings page.
   */
  label: string;
  /**
   * The chords each action is bound to by default, as `KeyBindingMap` takes
   * them.
   */
  defaults: Readonly<Record<TAction, string | readonly string[]>>;
  actions: Readonly<Record<NoInfer<TAction>, KeyBindingAction>>;
}

export type KeyBindingFields<TAction extends string> = Readonly<
  Record<TAction, ChordPreference>
>;

export function defineKeyBindings<TAction extends string>(
  definition: KeyBindingScopeDefinition<TAction>
): PreferenceScope<KeyBindingFields<TAction>> {
  const fields: Record<string, ChordPreference> = {};
  for (const [action, chords] of Object.entries<string | readonly string[]>(
    definition.defaults
  )) {
    const { label, group } = definition.actions[action as TAction];
    fields[action] = {
      type: "chord",
      label,
      ...(group === undefined ? {} : { group }),
      default: typeof chords === "string" ? [chords] : [...chords]
    };
  }

  return new PreferenceScope({
    name: definition.name,
    label: definition.label,
    fields: fields as KeyBindingFields<TAction>
  });
}
