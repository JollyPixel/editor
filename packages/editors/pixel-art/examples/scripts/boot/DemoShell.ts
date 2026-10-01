// Import Internal Dependencies
import {
  CANVAS_HOVER_CHANGE_EVENT,
  type PixelDrawPanel
} from "../../../src/index.ts";
import { PanelScope } from "../../../src/panel/PanelScope.ts";
import type { DemoPreview } from "./DemoPreview.ts";

export class DemoShell {
  readonly #panel: PixelDrawPanel;
  readonly #scope: PanelScope;
  readonly #preview: DemoPreview | null;
  readonly #resumeKeyboard: () => void;

  constructor(
    panel: PixelDrawPanel,
    scope: HTMLElement,
    preview: DemoPreview | null
  ) {
    this.#panel = panel;
    this.#preview = preview;

    panel.addEventListener("theme-change", this.#applyTheme);
    panel.addEventListener("texture-change", this.#followActiveTexture);
    this.#scope = new PanelScope(panel, scope);
    this.#resumeKeyboard = preview === null ?
      () => void 0 :
      preview.editorRuntime.suspendKeyboardOnHover(
        panel,
        CANVAS_HOVER_CHANGE_EVENT
      );
    this.#applyTheme();
  }

  dispose(): void {
    this.#scope.dispose();
    this.#panel.removeEventListener("theme-change", this.#applyTheme);
    this.#panel.removeEventListener("texture-change", this.#followActiveTexture);
    this.#resumeKeyboard();
    this.#preview?.scene.destroy();
  }

  readonly #applyTheme = (): void => {
    this.#preview?.scene.setAppearance(this.#panel.resolvedTheme);
  };

  readonly #followActiveTexture = (): void => {
    const canvas = this.#panel.canvasManager;
    if (canvas !== null) {
      this.#preview?.scene.setCanvas(canvas);
    }
  };
}
