// Import Internal Dependencies
import {
  CANVAS_HOVER_CHANGE_EVENT,
  type PixelDrawPanel
} from "../../../src/index.ts";
import type { DemoPreview } from "./DemoPreview.ts";

// CONSTANTS
const kScopeAttributes = ["theme", "density"];

export class DemoShell {
  readonly #panel: PixelDrawPanel;
  readonly #scope: HTMLElement;
  readonly #preview: DemoPreview | null;
  readonly #scopeObserver: MutationObserver;
  readonly #resumeKeyboard: () => void;

  constructor(
    panel: PixelDrawPanel,
    scope: HTMLElement,
    preview: DemoPreview | null
  ) {
    this.#panel = panel;
    this.#scope = scope;
    this.#preview = preview;

    panel.addEventListener("theme-change", this.#applyTheme);
    panel.addEventListener("texture-change", this.#followActiveTexture);
    this.#scopeObserver = new MutationObserver(this.#followScope);
    this.#scopeObserver.observe(scope, {
      attributes: true,
      attributeFilter: kScopeAttributes
    });
    this.#resumeKeyboard = preview === null ?
      () => void 0 :
      preview.editorRuntime.suspendKeyboardOnHover(
        panel,
        CANVAS_HOVER_CHANGE_EVENT
      );
    this.#followScope();
    this.#applyTheme();
  }

  dispose(): void {
    this.#scopeObserver.disconnect();
    this.#panel.removeEventListener("theme-change", this.#applyTheme);
    this.#panel.removeEventListener("texture-change", this.#followActiveTexture);
    this.#resumeKeyboard();
    this.#preview?.scene.destroy();
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

  readonly #applyTheme = (): void => {
    const { dataset } = document.documentElement;
    dataset.theme = this.#panel.theme;
    dataset.resolvedTheme = this.#panel.resolvedTheme;
    this.#preview?.scene.setAppearance(this.#panel.resolvedTheme);
  };

  readonly #followActiveTexture = (): void => {
    const canvas = this.#panel.canvasManager;
    if (canvas !== null) {
      this.#preview?.scene.setCanvas(canvas);
    }
  };
}
