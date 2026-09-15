// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type PropertyValues
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import {
  PixelArtCanvas,
  type PixelArtCanvasOptions,
  type Mode
} from "@jolly-pixel/pixel-draw.renderer";
import {
  ambientThemeMode,
  resolveThemeColor,
  themeStyles
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { ColorChangeDetail } from "../color/ColorSwatch.ts";
import { panelStyles } from "./PixelDrawPanel.styles.ts";
import { railButtonStyles } from "../mode-rail/rail-button.styles.ts";
import { iconStyles } from "../common/icon.styles.ts";
import { UvToolbarController } from "../toolbars/UvToolbarController.ts";
import { SelectToolbarController } from "../toolbars/SelectToolbarController.ts";
import { TextureDropController } from "../toolbars/TextureDropController.ts";
import { HistoryFileToolbarController } from "../toolbars/HistoryFileToolbarController.ts";
import { ToolOptionsController } from "../toolbars/ToolOptionsController.ts";
import {
  ColorController,
  type ColorPickedDetail
} from "../color/ColorController.ts";
import { assertElement } from "../../utils/dom.ts";
import { type ModeVariantDetail } from "../mode-rail/ModeRail.ts";
import {
  isUvAccess,
  modeAllowedBy,
  type UvAccess
} from "./uvAccess.ts";
import "../color/ColorPickerRail.ts";
import "../color/ColorDock.ts";

export type ThemeMode = "light" | "dark" | "auto";

function isThemeMode(
  value: string
): value is ThemeMode {
  return value === "light" || value === "dark" || value === "auto";
}

@customElement("pixel-draw-panel")
export class PixelDrawPanel extends LitElement {
  static override styles = [
    themeStyles,
    iconStyles,
    railButtonStyles,
    panelStyles
  ];

  @property({ type: Boolean, attribute: "allow-uv-create-delete" })
  declare allowUvCreateDelete: boolean;

  @property({
    type: String,
    reflect: true,
    attribute: "uv-access",
    converter: {
      fromAttribute(value) {
        return (value !== null && isUvAccess(value)) ? value : "edit";
      }
    }
  })
  declare uvAccess: UvAccess;

  @property({
    type: String,
    reflect: true,
    converter: {
      fromAttribute(value) {
        return (value !== null && isThemeMode(value)) ? value : "auto";
      }
    }
  })
  declare theme: ThemeMode;

  @property({ type: Boolean, reflect: true, attribute: "color-docked" })
  declare colorDocked: boolean;

  readonly #uvToolbar = new UvToolbarController(this);
  readonly #selectToolbar = new SelectToolbarController(this);
  readonly #textureDrop = new TextureDropController(this);
  readonly #historyFile = new HistoryFileToolbarController(this);
  readonly #toolOptions = new ToolOptionsController(this);
  readonly #colors = new ColorController(this);

  #canvasManager: PixelArtCanvas | null = null;
  #prefersDarkQuery: MediaQueryList | null = null;

  constructor() {
    super();
    this.allowUvCreateDelete = false;
    this.uvAccess = "edit";
    this.theme = "auto";
    this.colorDocked = false;
  }

  get canvasManager(): PixelArtCanvas | null {
    return this.#canvasManager;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.addEventListener(
      "colorpicked",
      this.#onColorPicked
    );
    this.#prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.#prefersDarkQuery.addEventListener("change", this.#onPrefersColorSchemeChange);
    this.#syncAmbientTheme();

    const stageEl = this.renderRoot.querySelector<HTMLDivElement>(".stage");
    if (this.#canvasManager && stageEl) {
      this.#attachControllers(this.#canvasManager, stageEl);
      this.requestUpdate();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(
      "colorpicked",
      this.#onColorPicked
    );
    this.#prefersDarkQuery?.removeEventListener("change", this.#onPrefersColorSchemeChange);
    this.#prefersDarkQuery = null;
    queueMicrotask(() => {
      if (this.isConnected) {
        return;
      }

      this.#canvasManager?.destroy();
      this.#canvasManager = null;
    });
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("colorDocked")) {
      this.#colors.docked = this.colorDocked;
    }
    if (changedProperties.has("uvAccess")) {
      this.#applyUvAccess();
    }
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    super.updated(changedProperties);
    if (changedProperties.has("theme")) {
      this.#syncCanvasBackground();
    }
    if (
      changedProperties.has("colorDocked") &&
      changedProperties.get("colorDocked") !== undefined
    ) {
      this.onResize();
    }
  }

  async initialize(
    options: PixelArtCanvasOptions = {}
  ): Promise<PixelArtCanvas> {
    await this.updateComplete;

    const canvasHostEl = assertElement(
      this.renderRoot.querySelector<HTMLDivElement>(".canvas-host"),
      "PixelDrawPanel: .canvas-host element not found"
    );
    const stageEl = assertElement(
      this.renderRoot.querySelector<HTMLDivElement>(".stage"),
      "PixelDrawPanel: .stage element not found"
    );
    const backgroundColor = this.#canvasBackground();
    this.#canvasManager = new PixelArtCanvas(canvasHostEl, {
      ...options,
      defaultMode: modeAllowedBy(options.defaultMode ?? "paint", this.uvAccess),
      backgroundColor: backgroundColor || options.backgroundColor,
      onHistoryChange: (state) => {
        this.#historyFile.onHistoryChange(state);
        options.onHistoryChange?.(state);
      },
      onModeChange: (mode, previousMode) => {
        this.#toolOptions.onCanvasModeChange(mode);
        this.#selectToolbar.onModeChange(mode === "select");
        options.onModeChange?.(mode, previousMode);
      },
      onClipboardResult: (result) => {
        this.#selectToolbar.onClipboardResult(result);
        options.onClipboardResult?.(result);
      }
    });

    this.#attachControllers(this.#canvasManager, stageEl);
    this.#applyUvAccess();
    this.#syncCanvasBackground();
    this.requestUpdate();
    await this.updateComplete;
    this.setAttribute("data-ready", "");

    return this.#canvasManager;
  }

  onResize(): void {
    this.#canvasManager?.onResize();
  }

  readonly #onColorPicked = (
    event: CustomEvent<ColorPickedDetail>
  ): void => {
    this.#colors.onColorPicked(event.detail);
    this.#toolOptions.disarmPickColor();
    this.requestUpdate();
  };

  readonly #onPrefersColorSchemeChange = (): void => {
    if (this.theme === "auto") {
      this.#syncCanvasBackground();
    }
  };

  #onDockToggle(): void {
    this.colorDocked = !this.colorDocked;

    const customEvent = new CustomEvent<boolean>("color-docked-change", {
      bubbles: true,
      composed: true,
      detail: this.colorDocked
    });
    this.dispatchEvent(customEvent);
  }

  #attachControllers(
    canvas: PixelArtCanvas,
    stageEl: HTMLDivElement
  ): void {
    this.#toolOptions.attach(canvas);
    this.#colors.attach(canvas);
    this.#historyFile.attach(canvas);
    this.#uvToolbar.attach(canvas);
    this.#selectToolbar.attach(canvas);
    this.#textureDrop.attach(canvas, stageEl);
  }

  #applyUvAccess(): void {
    const mode = modeAllowedBy(this.#toolOptions.mode, this.uvAccess);
    if (mode !== this.#toolOptions.mode) {
      this.#toolOptions.setMode(mode);
    }
    if (this.uvAccess === "none" && this.#toolOptions.fillUvClip) {
      this.#toolOptions.setFillUvClip(false);
    }
  }

  #syncAmbientTheme(): void {
    const ambient = ambientThemeMode(this);
    if (ambient === null) {
      delete this.dataset.ambientTheme;
    }
    else {
      this.dataset.ambientTheme = ambient;
    }
  }

  #syncCanvasBackground(): void {
    if (!this.#canvasManager) {
      return;
    }

    const canvasBg = this.#canvasBackground();
    if (canvasBg) {
      this.#canvasManager.backgroundColor = canvasBg;
    }
  }

  #canvasBackground(): string {
    return resolveThemeColor(this, "--color-canvas-bg");
  }

  #onModeVariantChange(
    { mode, value }: ModeVariantDetail
  ): void {
    this.#toolOptions.setMode(mode);
    if (mode === "fill") {
      this.#toolOptions.setFillGlobal(value);
    }
    else if (mode === "select") {
      this.#toolOptions.setSelectShape(value);
    }
  }

  override render() {
    return html`
      <div class="rail" part="rail">
        <mode-rail
          .mode=${this.#toolOptions.mode}
          .pickColorArmed=${this.#toolOptions.pickColorArmed}
          .fillGlobal=${this.#toolOptions.fillGlobal}
          .fillUvClip=${this.#toolOptions.fillUvClip}
          .selectShape=${this.#toolOptions.selectShape}
          .uvAccess=${this.uvAccess}
          @mode-change=${(event: CustomEvent<Mode>) => this.#toolOptions.setMode(event.detail)}
          @pick-color-toggle=${() => this.#toolOptions.togglePickColor()}
          @fill-uv-clip-change=${(event: CustomEvent<boolean>) => {
            this.#toolOptions.setMode("fill");
            this.#toolOptions.setFillUvClip(event.detail);
          }}
          @mode-variant-change=${(event: CustomEvent<ModeVariantDetail>) => {
            this.#onModeVariantChange(event.detail);
          }}
        ></mode-rail>

        <div class="rail-divider"></div>

        <color-picker-rail
          part="color-picker"
          .foreground=${this.#colors.foreground}
          .background=${this.#colors.background}
          .docked=${this.colorDocked}
          @foreground-change=${(event: CustomEvent<ColorChangeDetail>) => {
            this.#colors.onForegroundChange(event);
          }}
          @background-change=${(event: CustomEvent<ColorChangeDetail>) => {
            this.#colors.onBackgroundChange(event);
          }}
          @swap=${() => this.#colors.swap()}
          @dock-toggle=${() => this.#onDockToggle()}
        ></color-picker-rail>
      </div>

      <div class="workspace" part="workspace">
        <div class="stage" part="stage">
          <div class="canvas-host" part="canvas-host"></div>
          ${this.#textureDrop.render()}
          ${this.#toolOptions.render()}
          ${this.#selectToolbar.render(this.#toolOptions.mode === "select")}
          ${this.#uvToolbar.render(
            this.#toolOptions.mode === "uv" && this.uvAccess === "edit",
            this.allowUvCreateDelete
          )}
          ${this.#historyFile.render(
            this.uvAccess === "view" ? this.#uvToolbar.renderVisibilityToggles() : nothing
          )}
        </div>
        ${this.colorDocked ? html`
          <color-dock
            class="color-dock"
            part="color-dock"
            .color=${this.#colors.foreground.hex}
            .opacity=${this.#colors.foreground.opacity}
            @color-change=${(event: CustomEvent<ColorChangeDetail>) => {
              this.#colors.onActiveChange(event);
            }}
          ></color-dock>
        ` : nothing}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-draw-panel": PixelDrawPanel;
  }

  interface HTMLElementEventMap {
    colorpicked: CustomEvent<ColorPickedDetail>;
    "color-docked-change": CustomEvent<boolean>;
  }
}
