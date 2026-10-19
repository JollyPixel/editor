// Import Third-party Dependencies
import {
  LANTERN_PREFERENCES,
  RUNTIME_PREFERENCES,
  type PreferenceScope
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import { STUDIO_PREFERENCES } from "../../preferences/studioScope.ts";

// CONSTANTS
export const PROFILE_SECTION = "profile";
export const APPEARANCE_SECTION = "appearance";
export const KEYBINDINGS_SECTION = "keybindings";
const kAppearanceScopes = new Set(
  [STUDIO_PREFERENCES, RUNTIME_PREFERENCES, LANTERN_PREFERENCES].map(
    (scope) => scope.name
  )
);

export type SettingsTier = "you" | "project";

export type SettingsSection =
  | {
    id: typeof PROFILE_SECTION;
    label: string;
    tier: "you";
    kind: "profile";
  }
  | {
    id: string;
    label: string;
    tier: SettingsTier;
    kind: "form" | "keybindings";
    scopes: readonly PreferenceScope[];
  };

export interface SettingsSectionsOptions {
  signedIn: boolean;
  scopes: Iterable<PreferenceScope>;
}

export class SettingsSections implements Iterable<SettingsSection> {
  static readonly EMPTY = new SettingsSections({
    signedIn: false,
    scopes: []
  });

  #sections: SettingsSection[] = [];

  constructor(
    options: SettingsSectionsOptions
  ) {
    if (options.signedIn) {
      this.#sections.push({
        id: PROFILE_SECTION,
        label: "Profile",
        tier: "you",
        kind: "profile"
      });
    }

    const all = [...options.scopes];
    const scopes = all.filter((scope) => scope.form.length > 0);
    this.#sections.push({
      id: APPEARANCE_SECTION,
      label: "Appearance",
      tier: "you",
      kind: "form",
      scopes: scopes.filter((scope) => kAppearanceScopes.has(scope.name))
    });
    const keybindings = all.filter((scope) => scope.keyBindings.length > 0);
    if (keybindings.length > 0) {
      this.#sections.push({
        id: KEYBINDINGS_SECTION,
        label: "Keybindings",
        tier: "you",
        kind: "keybindings",
        scopes: keybindings
      });
    }
    for (const scope of scopes) {
      if (!kAppearanceScopes.has(scope.name)) {
        this.#sections.push({
          id: scope.name,
          label: scope.label,
          tier: "you",
          kind: "form",
          scopes: [scope]
        });
      }
    }
  }

  get ids(): string[] {
    return this.#sections.map((section) => section.id);
  }

  get first(): SettingsSection | undefined {
    return this.#sections[0];
  }

  find(
    id: string
  ): SettingsSection | undefined {
    return this.#sections.find((section) => section.id === id);
  }

  inTier(
    tier: SettingsTier
  ): SettingsSection[] {
    return this.#sections.filter((section) => section.tier === tier);
  }

  [Symbol.iterator](): IterableIterator<SettingsSection> {
    return this.#sections.values();
  }
}
