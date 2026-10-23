// Import Third-party Dependencies
import type {
  Density,
  ThemeMode
} from "@jolly-pixel/ui";

// CONSTANTS
const kScopeSelector = "jolly-scope";
const kAppearanceAttributes = ["theme", "density"];

export interface Appearance {
  theme: ThemeMode;
  density: Density;
}

export class PageAppearance implements Appearance {
  #root: ParentNode;

  constructor(
    root: ParentNode = document
  ) {
    this.#root = root;
  }

  get theme(): ThemeMode {
    const theme = this.#firstScope()?.getAttribute("theme");

    return theme === "light" || theme === "dark" ?
      theme :
      "auto";
  }

  set theme(
    theme: ThemeMode
  ) {
    for (const scope of this.#requiredScopes()) {
      writeTheme(scope, theme);
    }
  }

  get density(): Density {
    const density = this.#firstScope()?.getAttribute("density");

    return density === "compact" || density === "comfortable" ?
      density :
      "default";
  }

  set density(
    density: Density
  ) {
    for (const scope of this.#requiredScopes()) {
      scope.setAttribute("density", density);
    }
  }

  apply(
    appearance: Appearance
  ): void {
    for (const scope of this.#root.querySelectorAll(kScopeSelector)) {
      writeTheme(scope, appearance.theme);
      scope.setAttribute("density", appearance.density);
    }
  }

  watch(
    listener: (appearance: Appearance) => void,
    signal: AbortSignal
  ): void {
    if (signal.aborted) {
      return;
    }

    const observer = new MutationObserver((records) => {
      if (records.some((record) => isScope(record.target))) {
        listener(this.toJSON());
      }
    });
    observer.observe(this.#root, {
      subtree: true,
      attributeFilter: kAppearanceAttributes
    });
    signal.addEventListener("abort", () => observer.disconnect(), {
      once: true
    });
  }

  toJSON(): Appearance {
    return {
      theme: this.theme,
      density: this.density
    };
  }

  #firstScope(): Element | null {
    return this.#root.querySelector(kScopeSelector);
  }

  #requiredScopes(): NodeListOf<Element> {
    const scopes = this.#root.querySelectorAll(kScopeSelector);
    if (scopes.length === 0) {
      throw new Error("This page has no jolly-scope");
    }

    return scopes;
  }
}

function isScope(
  node: Node
): boolean {
  return node instanceof Element && node.matches(kScopeSelector);
}

function writeTheme(
  scope: Element,
  theme: ThemeMode
): void {
  if (theme === "auto") {
    scope.removeAttribute("theme");
  }
  else {
    scope.setAttribute("theme", theme);
  }
}
