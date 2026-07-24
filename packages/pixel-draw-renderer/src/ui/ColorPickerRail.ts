// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  type PropertyValues
} from "lit";
import { customElement, property } from "lit/decorators.js";

// Import Internal Dependencies
// ColorSwatch is imported as a value (not `type`) so this statement isn't
// elided — its module has to run once to register <color-swatch>.
import { ColorSwatch, type ColorChangeDetail } from "./ColorSwatch.ts";
import { renderIcon } from "./icons.ts";
import { iconStyles } from "./icon.styles.ts";

/**
 * Foreground/background color swatches plus the swap button. Fully
 * controlled via `foreground`/`background` props — reports intent via
 * `foreground-change`/`background-change`/`swap` events instead of owning
 * canonical color state. Also owns closing the sibling swatch when one
 * opens, since that coordination is purely local to these two children.
 *
 * @fires {CustomEvent<ColorChangeDetail>} foreground-change
 * @fires {CustomEvent<ColorChangeDetail>} background-change
 * @fires {CustomEvent<void>} swap
 */
@customElement("color-picker-rail")
export class ColorPickerRail extends LitElement {
  static override styles = [iconStyles, css`
    /*
     * Self-contained box: fg/bg swatches and the swap button all stay
     * within these bounds (no negative offsets), so the rail's own gap
     * is the true, symmetric visual spacing above/below this element.
     */
    :host {
      position: relative;
      display: block;
      width: 44px;
      height: 44px;
    }

    .swatch {
      position: absolute;
    }
    .swatch.fg {
      top: 4px;
      left: 0;
      z-index: 2;
    }
    .swatch.bg {
      right: 0;
      bottom: 0;
      z-index: 1;
    }
    .swatch::part(swatch) {
      width: 24px;
      height: 24px;
    }

    .swap-btn {
      position: absolute;
      top: 0;
      right: 0;
      z-index: 3;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 16px;
      height: 16px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: var(--color-bg-control);
      color: var(--color-text-emphasis);
      font-size: 9px;
      line-height: 1;
      cursor: pointer;
    }
    .swap-btn:hover {
      background: var(--color-accent);
    }
    .swap-btn .icon {
      width: 11px;
      height: 11px;
    }
  `];

  @property({ attribute: false }) declare foreground: ColorChangeDetail;
  @property({ attribute: false }) declare background: ColorChangeDetail;

  #fgSwatchEl: ColorSwatch | null = null;
  #bgSwatchEl: ColorSwatch | null = null;

  constructor() {
    super();
    this.foreground = { hex: "#000000", opacity: 1 };
    this.background = { hex: "#ffffff", opacity: 1 };
  }

  override firstUpdated(): void {
    this.#fgSwatchEl = this.shadowRoot!.querySelector<ColorSwatch>("color-swatch.fg");
    this.#bgSwatchEl = this.shadowRoot!.querySelector<ColorSwatch>("color-swatch.bg");
  }

  /**
   * ColorSwatch only paints its swatch/picker from `color`/`opacity` in
   * firstUpdated() — later property changes need an explicit setColor() to
   * actually repaint it, hence the manual push here instead of relying on
   * the property bindings in render() alone.
   */
  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("foreground")) {
      this.#fgSwatchEl?.setColor(this.foreground.hex, this.foreground.opacity);
    }
    if (changedProperties.has("background")) {
      this.#bgSwatchEl?.setColor(this.background.hex, this.background.opacity);
    }
  }

  #onForegroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    this.dispatchEvent(new CustomEvent<ColorChangeDetail>("foreground-change", {
      bubbles: true,
      composed: true,
      detail: event.detail
    }));
  }

  #onBackgroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    this.dispatchEvent(new CustomEvent<ColorChangeDetail>("background-change", {
      bubbles: true,
      composed: true,
      detail: event.detail
    }));
  }

  #onSwapClick(): void {
    this.dispatchEvent(new CustomEvent("swap", { bubbles: true, composed: true }));
  }

  /**
   * Closes the sibling swatch so foreground/background pickers can't both be
   * open. Crossing the color-swatch's shadow boundary retargets event.target
   * to this element itself, so composedPath()[0] is used to find the actual
   * swatch that opened.
   */
  #onSwatchOpened(
    event: Event
  ): void {
    const opened = event.composedPath()[0];
    for (const swatch of this.shadowRoot!.querySelectorAll<ColorSwatch>("color-swatch")) {
      if (swatch !== opened) {
        swatch.close();
      }
    }
  }

  override render() {
    return html`
      <color-swatch
        class="swatch fg" part="fg-swatch"
        .color=${this.foreground.hex} .opacity=${this.foreground.opacity}
        @color-change=${this.#onForegroundChange}
        @swatch-opened=${this.#onSwatchOpened}
      ></color-swatch>
      <color-swatch
        class="swatch bg" part="bg-swatch"
        .color=${this.background.hex} .opacity=${this.background.opacity}
        @color-change=${this.#onBackgroundChange}
        @swatch-opened=${this.#onSwatchOpened}
      ></color-swatch>
      <button
        class="swap-btn" part="swap-button"
        aria-label="Swap foreground and background colors"
        @click=${this.#onSwapClick}
      >${renderIcon("swap")}</button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-picker-rail": ColorPickerRail;
  }
}
