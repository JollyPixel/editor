// Import Third-party Dependencies
import type { Appearance, PageAppearance } from "@jolly-pixel/editor.host";
import type { Preferences } from "@jolly-pixel/preferences";
import type {
  Density,
  StorageAdapter,
  ThemeMode
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { STUDIO_PREFERENCES } from "../../shared/studioScope.ts";

// CONSTANTS
export const APPEARANCE_HINT_STORAGE_KEY = "studio:appearance";

export interface StudioAppearanceOptions {
  page: PageAppearance;
  /**
   * Keeps the last applied appearance for the next page load, so the
   * studio paints with it before the account's preferences arrive.
   */
  hint: StorageAdapter;
}

export class StudioAppearance implements Appearance {
  #page: PageAppearance;
  #hint: StorageAdapter;
  #preferences: Preferences | null = null;
  #unwatch: (() => void) | null = null;

  constructor(
    options: StudioAppearanceOptions
  ) {
    this.#page = options.page;
    this.#hint = options.hint;
    const hint = this.#hint.get(APPEARANCE_HINT_STORAGE_KEY);
    if (hint !== null) {
      this.#page.apply(
        STUDIO_PREFERENCES.resolve(STUDIO_PREFERENCES.prune(parseJson(hint)))
      );
    }
  }

  get theme(): ThemeMode {
    return this.#page.theme;
  }

  set theme(
    theme: ThemeMode
  ) {
    this.#assign("theme", theme);
  }

  get density(): Density {
    return this.#page.density;
  }

  set density(
    density: Density
  ) {
    this.#assign("density", density);
  }

  follow(
    preferences: Preferences
  ): void {
    this.#unwatch?.();
    this.#preferences = preferences;
    this.#apply(preferences.values(STUDIO_PREFERENCES));
    this.#unwatch = preferences.watch(STUDIO_PREFERENCES, this.#apply);
  }

  #assign(
    key: keyof Appearance,
    value: string
  ): void {
    if (this.#preferences === null) {
      this.#apply({
        ...this.#page.toJSON(),
        [key]: value
      });
    }
    else {
      this.#preferences.assign(STUDIO_PREFERENCES, key, value);
    }
  }

  readonly #apply = (
    values: Appearance
  ): void => {
    const appearance = {
      theme: values.theme,
      density: values.density
    };
    this.#page.apply(appearance);
    this.#hint.set(APPEARANCE_HINT_STORAGE_KEY, JSON.stringify(appearance));
  };
}

function parseJson(
  text: string
): unknown {
  try {
    return JSON.parse(text);
  }
  catch {
    return null;
  }
}
