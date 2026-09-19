// Import Internal Dependencies
import type {
  CanvasHoverChangeDetail,
  PixelDrawPanel
} from "../../../src/index.ts";
import type { DemoPreview } from "./DemoPreview.ts";

export class DemoShell {
  readonly #panel: PixelDrawPanel;
  readonly #preview: DemoPreview | null;

  constructor(
    panel: PixelDrawPanel,
    preview: DemoPreview | null
  ) {
    this.#panel = panel;
    this.#preview = preview;

    panel.addEventListener("theme-change", this.#applyTheme);
    panel.addEventListener("texture-change", this.#followActiveTexture);
    panel.addEventListener("canvas-hover-change", this.#suspendKeyboard);
    this.#applyTheme();
  }

  dispose(): void {
    this.#panel.removeEventListener("theme-change", this.#applyTheme);
    this.#panel.removeEventListener("texture-change", this.#followActiveTexture);
    this.#panel.removeEventListener("canvas-hover-change", this.#suspendKeyboard);
    this.#preview?.scene.destroy();
  }

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

  readonly #suspendKeyboard = (
    event: CustomEvent<CanvasHoverChangeDetail>
  ): void => {
    if (this.#preview !== null) {
      this.#preview.runtime.world.input.keyboard.enabled = !event.detail.hovering;
    }
  };
}
