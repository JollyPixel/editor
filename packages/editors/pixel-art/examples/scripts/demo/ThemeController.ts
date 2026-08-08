// Import Internal Dependencies
import type { ThemeMode } from "../../../src/index.ts";

// CONSTANTS
const kDarkThemeQuery = "(prefers-color-scheme: dark)";

export interface ThemeControllerOptions {
  drawPanel: ThemeTarget;
  select: HTMLSelectElement;
  onResolvedThemeChange: (
    theme: Exclude<ThemeMode, "auto">
  ) => void;
}

export interface ThemeTarget {
  theme: ThemeMode;
}

export class ThemeController {
  readonly #drawPanel: ThemeTarget;
  readonly #select: HTMLSelectElement;
  readonly #prefersDarkQuery: MediaQueryList;
  readonly #onResolvedThemeChange: ThemeControllerOptions["onResolvedThemeChange"];
  #disposed = false;

  constructor(
    options: ThemeControllerOptions
  ) {
    this.#drawPanel = options.drawPanel;
    this.#select = options.select;
    this.#onResolvedThemeChange = options.onResolvedThemeChange;
    this.#prefersDarkQuery = window.matchMedia(kDarkThemeQuery);

    this.#select.addEventListener("change", this.#applyTheme);
    this.#prefersDarkQuery.addEventListener(
      "change",
      this.#handlePreferredThemeChange
    );
    this.#applyTheme();
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#select.removeEventListener("change", this.#applyTheme);
    this.#prefersDarkQuery.removeEventListener(
      "change",
      this.#handlePreferredThemeChange
    );
  }

  readonly #applyTheme = (): void => {
    const theme = themeFrom(this.#select.value);
    const resolvedTheme = theme === "auto" ?
      this.#preferredTheme() :
      theme;

    this.#drawPanel.theme = theme;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.resolvedTheme = resolvedTheme;
    this.#onResolvedThemeChange(resolvedTheme);
  };

  readonly #handlePreferredThemeChange = (): void => {
    if (this.#select.value === "auto") {
      this.#applyTheme();
    }
  };

  #preferredTheme(): Exclude<ThemeMode, "auto"> {
    return this.#prefersDarkQuery.matches ? "dark" : "light";
  }
}

function themeFrom(
  value: string
): ThemeMode {
  switch (value) {
    case "light":
    case "dark":
      return value;
    default:
      return "auto";
  }
}
