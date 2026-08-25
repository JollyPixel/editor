// Import Third-party Dependencies
import {
  LitElement,
  html,
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
import { ColorController } from "../color/ColorController.ts";
import { assertElement } from "../../utils/dom.ts";

// Side-effect imports: register custom elements (also carries ModeVariantDetail's type).
import { type ModeVariantDetail } from "../mode-rail/ModeRail.ts";
import "../color/ColorPickerRail.ts";

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

  /**
   * Off by default: create/delete only suit authoring contexts (the
   * package's own example), not embeddings over a fixed mesh (voxel-map).
   */
  @property({ type: Boolean, attribute: "allow-uv-create-delete" })
  declare allowUvCreateDelete: boolean;

  /**
   * "auto" follows the theme scope the panel is embedded in, and
   * prefers-color-scheme when it is embedded in none; "light"/"dark" force a
   * palette regardless. Reflects to the `theme` attribute, which is
   * what the CSS override selectors key off. `jolly-theme-preferences`
   * removes the attribute entirely for "auto" rather than writing it out, so
   * the converter maps a missing/null attribute back to "auto" instead of
   * leaving the property `null`.
   */
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
    this.theme = "auto";
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
    // "auto" resolves via CSS, but the canvas is JS-painted (see
    // #syncCanvasBackground) — it needs its own live-toggle hookup to track
    // an OS scheme change mid-session instead of the CSS cascade doing it.
    this.#prefersDarkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.#prefersDarkQuery.addEventListener("change", this.#onPrefersColorSchemeChange);
    this.#syncAmbientTheme();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener(
      "colorpicked",
      this.#onColorPicked
    );
    this.#prefersDarkQuery?.removeEventListener("change", this.#onPrefersColorSchemeChange);
    this.#prefersDarkQuery = null;
    this.#canvasManager?.destroy();
    this.#canvasManager = null;
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    super.updated(changedProperties);
    if (changedProperties.has("theme")) {
      this.#syncCanvasBackground();
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

    this.#toolOptions.attach(this.#canvasManager);
    this.#colors.attach(this.#canvasManager);
    this.#historyFile.attach(this.#canvasManager);
    this.#uvToolbar.attach(this.#canvasManager);
    this.#selectToolbar.attach(this.#canvasManager);
    this.#textureDrop.attach(this.#canvasManager, stageEl);
    this.#syncCanvasBackground();
    this.requestUpdate();
    await this.updateComplete;
    this.setAttribute("data-ready", "");

    return this.#canvasManager;
  }

  onResize(): void {
    this.#canvasManager?.onResize();
  }

  /**
    * A pick spans two controllers: color state and picker-armed state.
   */
  readonly #onColorPicked = (
    event: CustomEvent<ColorChangeDetail>
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

  /**
   * Embedded in an editor, the panel is one surface among many and has to
   * match them; the OS preference only decides when the surrounding page has
   * stated none. `theme` stays the author's setting either way — this records
   * what "auto" resolved to, which the styles read to pick a palette.
   */
  #syncAmbientTheme(): void {
    const ambient = ambientThemeMode(this);
    if (ambient === null) {
      delete this.dataset.ambientTheme;
    }
    else {
      this.dataset.ambientTheme = ambient;
    }
  }

  /**
   * PixelArtCanvas paints its own void color on a <canvas> (not CSS), so it
   * can't pick up --color-canvas-bg from the cascade on its own — read the
   * resolved value and push it in, keeping the canvas one source of truth
   * (PixelDrawPanel.styles.ts) instead of duplicating the palette in JS.
   */
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

  /**
   * Picking a variant from the rail flyout (e.g. Fill > Global) implies
   * switching to that mode too — the flyout works even when hovering a
   * mode that isn't active yet.
   */
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
          .selectShape=${this.#toolOptions.selectShape}
          @mode-change=${(event: CustomEvent<Mode>) => this.#toolOptions.setMode(event.detail)}
          @pick-color-toggle=${() => this.#toolOptions.togglePickColor()}
          @mode-variant-change=${(event: CustomEvent<ModeVariantDetail>) => this.#onModeVariantChange(event.detail)}
        ></mode-rail>

        <div class="rail-divider"></div>

        <color-picker-rail
          part="color-picker"
          .foreground=${this.#colors.foreground}
          .background=${this.#colors.background}
          @foreground-change=${(event: CustomEvent<ColorChangeDetail>) => this.#colors.onForegroundChange(event)}
          @background-change=${(event: CustomEvent<ColorChangeDetail>) => this.#colors.onBackgroundChange(event)}
          @swap=${() => this.#colors.swap()}
        ></color-picker-rail>
      </div>

      <div class="stage" part="stage">
        <div class="canvas-host" part="canvas-host"></div>
        ${this.#textureDrop.render()}
        ${this.#toolOptions.render()}
        ${this.#selectToolbar.render(this.#toolOptions.mode === "select")}
        ${this.#uvToolbar.render(this.#toolOptions.mode === "uv", this.allowUvCreateDelete)}
        ${this.#historyFile.render()}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "pixel-draw-panel": PixelDrawPanel;
  }

  interface HTMLElementEventMap {
    colorpicked: CustomEvent<ColorChangeDetail>;
  }
}
