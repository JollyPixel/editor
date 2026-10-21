// Import Third-party Dependencies
import {
  isKeyCode,
  type KeyChord,
  type KeyboardLayout,
  type KeyboardLayoutStore
} from "@jolly-pixel/controls";
import type {
  BindingPreference,
  PreferenceScope,
  Preferences
} from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import {
  BoundChord,
  type BoundChordOptions
} from "./BoundChord.ts";
import { HeldKey } from "./HeldKey.ts";

export interface KeybindingRow {
  action: string;
  kind: BindingPreference["type"];
  label: string;
  chords: readonly BoundChord[];
  customized: boolean;
  clashes: readonly string[];
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

export interface KeybindingTableOptions extends Omit<BoundChordOptions, "layout"> {
  layout?: Pick<KeyboardLayoutStore, "layout">;
  shortcutScopes?: Iterable<PreferenceScope>;
}

interface ScopeShortcut {
  chord: KeyChord;
  label: string;
}

export class KeybindingTable {
  #scopes: readonly PreferenceScope[];
  #shortcutScopes: readonly PreferenceScope[];
  #preferences: Preferences;
  #options: KeybindingTableOptions;

  constructor(
    scopes: Iterable<PreferenceScope>,
    preferences: Preferences,
    options: KeybindingTableOptions = {}
  ) {
    this.#scopes = [...scopes].filter((scope) => scope.keyBindings.length > 0);
    this.#shortcutScopes = [...options.shortcutScopes ?? []];
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
    const layout = this.#options.layout?.layout ?? null;

    return this.#scopes.flatMap((scope) => {
      const overrides = this.#preferences.overrides(scope.name);
      const bindings = scope.bindings(overrides);
      const shortcuts = this.#shortcuts(scope);
      const groups = scope.keyBindings
        .map((group) => {
          return {
            label: group.label,
            rows: group.fields
              .map(([action, field]) => {
                const bound = bindings.get(action) ?? [];

                return {
                  action,
                  kind: field.type,
                  label: field.label,
                  chords: this.#chords(bound, layout),
                  customized: Object.hasOwn(overrides, action),
                  clashes: field.type === "key" ?
                    KeybindingTable.#clashes(bound, shortcuts, layout) :
                    []
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

  static #clashes(
    codes: readonly string[],
    shortcuts: readonly ScopeShortcut[],
    layout: KeyboardLayout | null
  ): string[] {
    const held = new HeldKey(codes.filter(isKeyCode));

    return shortcuts
      .filter((shortcut) => held.triggers(shortcut.chord, layout))
      .map((shortcut) => shortcut.label);
  }

  #shortcuts(
    owner: PreferenceScope
  ): ScopeShortcut[] {
    return this.#shortcutScopes
      .filter((scope) => scope.name !== owner.name)
      .flatMap((scope) => {
        const bindings = scope.bindings(
          this.#preferences.overrides(scope.name)
        );

        return scope.keyBindings
          .flatMap((group) => group.fields)
          .filter(([, field]) => field.type === "chord")
          .flatMap(([action, field]) => (bindings.get(action) ?? [])
            .map((text) => BoundChord.parse(text, {
              apple: this.#options.apple
            }))
            .filter((bound) => bound !== null)
            .map((bound) => {
              return {
                chord: bound.chord,
                label: `"${field.label}" (${scope.label})`
              };
            }));
      });
  }

  #chords(
    chords: readonly string[],
    layout: KeyboardLayout | null
  ): BoundChord[] {
    const options = {
      apple: this.#options.apple,
      layout
    };
    const labels = new Map<string, BoundChord>();
    for (const text of chords) {
      const chord = BoundChord.parse(text, options);
      if (chord !== null && !labels.has(chord.label)) {
        labels.set(chord.label, chord);
      }
    }

    return [...labels.values()];
  }
}

function matches(
  row: KeybindingRow,
  needle: string
): boolean {
  return row.label.toLowerCase().includes(needle) ||
    row.chords.some((chord) => chord.label.toLowerCase().includes(needle));
}
