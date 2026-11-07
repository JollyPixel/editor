// Import Third-party Dependencies
import {
  DENSITIES,
  THEME_MODES,
  type Density,
  type StorageAdapter,
  type ThemeMode
} from "@jolly-pixel/ui";
import { is } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type {
  Appearance,
  PageAppearance
} from "./PageAppearance.ts";

// CONSTANTS
const kThemeStorageKey = "jolly-pixel:theme";
const kDensityStorageKey = "jolly-pixel:density";

export interface StoredAppearanceOptions {
  page: PageAppearance;
  storage: StorageAdapter;
}

export class StoredAppearance implements Appearance {
  #page: PageAppearance;
  #storage: StorageAdapter;

  constructor(
    options: StoredAppearanceOptions
  ) {
    this.#page = options.page;
    this.#storage = options.storage;
  }

  get theme(): ThemeMode {
    return this.#page.theme;
  }

  set theme(
    theme: ThemeMode
  ) {
    this.#page.theme = theme;
    this.#storage.set(kThemeStorageKey, theme);
  }

  get density(): Density {
    return this.#page.density;
  }

  set density(
    density: Density
  ) {
    this.#page.density = density;
    this.#storage.set(kDensityStorageKey, density);
  }

  restore(): void {
    const theme = this.#storage.get(kThemeStorageKey);
    const density = this.#storage.get(kDensityStorageKey);
    const storedTheme = is.member(theme, THEME_MODES);
    const storedDensity = is.member(density, DENSITIES);
    if (!storedTheme && !storedDensity) {
      return;
    }

    this.#page.apply({
      theme: storedTheme ? theme : this.#page.theme,
      density: storedDensity ? density : this.#page.density
    });
  }
}
