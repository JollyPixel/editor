// Import Internal Dependencies
import "../theme/components/ThemePreferences.ts";
import { FacadeElement } from "./Element.ts";
import type {
  ThemePreferencesLayout
} from "../theme/components/ThemePreferences.ts";

export interface ThemePreferencesOptions {
  layout?: ThemePreferencesLayout;
  storageKey?: string;
  target?: HTMLElement;
}

export type FacadeThemePreferences = FacadeElement<
  HTMLElementTagNameMap["jolly-theme-preferences"]
>;

export function createThemePreferences(
  options: ThemePreferencesOptions = {}
): FacadeThemePreferences {
  const element = document.createElement("jolly-theme-preferences");
  element.layout = options.layout ?? "stack";
  if (options.storageKey !== undefined) {
    element.storageKey = options.storageKey;
  }
  if (options.target !== undefined) {
    element.target = options.target;
  }

  return new FacadeElement(element);
}
