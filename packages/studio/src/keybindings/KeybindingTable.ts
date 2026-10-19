// Import Third-party Dependencies
import type {
  PreferenceScope,
  Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  BoundChord,
  type BoundChordOptions
} from "./BoundChord.ts";

export interface KeybindingRow {
  action: string;
  label: string;
  chords: readonly BoundChord[];
  customized: boolean;
}

export interface KeybindingGroup {
  label: string | null;
  rows: readonly KeybindingRow[];
}

export interface KeybindingSection {
  scope: PreferenceScope;
  groups: readonly KeybindingGroup[];
  customized: boolean;
}

export class KeybindingTable {
  #scopes: readonly PreferenceScope[];
  #preferences: Preferences;
  #options: BoundChordOptions;

  constructor(
    scopes: Iterable<PreferenceScope>,
    preferences: Preferences,
    options: BoundChordOptions = {}
  ) {
    this.#scopes = [...scopes].filter((scope) => scope.keyBindings.length > 0);
    this.#preferences = preferences;
    this.#options = options;
  }

  get scopes(): readonly PreferenceScope[] {
    return this.#scopes;
  }

  sections(
    query = ""
  ): KeybindingSection[] {
    const needle = query.trim().toLowerCase();

    return this.#scopes.flatMap((scope) => {
      const overrides = this.#preferences.overrides(scope.name);
      const bindings = scope.bindings(overrides);
      const groups = scope.keyBindings
        .map((group) => {
          return {
            label: group.label,
            rows: group.fields
              .map(([action, field]) => {
                return {
                  action,
                  label: field.label,
                  chords: this.#chords(bindings.get(action) ?? []),
                  customized: Object.hasOwn(overrides, action)
                };
              })
              .filter((row) => needle === "" || matches(row, needle))
          };
        })
        .filter((group) => group.rows.length > 0);

      return groups.length === 0 ? [] : [{
        scope,
        groups,
        customized: Object.keys(overrides).length > 0
      }];
    });
  }

  #chords(
    chords: readonly string[]
  ): BoundChord[] {
    return chords
      .map((text) => BoundChord.parse(text, this.#options))
      .filter((chord) => chord !== null);
  }
}

function matches(
  row: KeybindingRow,
  needle: string
): boolean {
  return row.label.toLowerCase().includes(needle) ||
    row.chords.some((chord) => chord.label.toLowerCase().includes(needle));
}
