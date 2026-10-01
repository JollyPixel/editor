// Import Internal Dependencies
import type { PixelDrawPanel } from "./PixelDrawPanel.ts";

// CONSTANTS
const kScopeAttributes = ["theme", "density"];

export class PanelScope {
  readonly #panel: PixelDrawPanel;
  readonly #scope: HTMLElement;
  readonly #observer: MutationObserver;

  constructor(
    panel: PixelDrawPanel,
    scope: HTMLElement
  ) {
    this.#panel = panel;
    this.#scope = scope;

    panel.addEventListener("theme-change", this.#publishTheme);
    this.#observer = new MutationObserver(this.#followScope);
    this.#observer.observe(scope, {
      attributes: true,
      attributeFilter: kScopeAttributes
    });
    this.#followScope();
    this.#publishTheme();
  }

  dispose(): void {
    this.#observer.disconnect();
    this.#panel.removeEventListener("theme-change", this.#publishTheme);
  }

  readonly #followScope = (): void => {
    for (const name of kScopeAttributes) {
      const value = this.#scope.getAttribute(name);
      if (value === null) {
        this.#panel.removeAttribute(name);
      }
      else {
        this.#panel.setAttribute(name, value);
      }
    }
  };

  readonly #publishTheme = (): void => {
    const { dataset } = document.documentElement;
    dataset.theme = this.#panel.theme;
    dataset.resolvedTheme = this.#panel.resolvedTheme;
  };
}
