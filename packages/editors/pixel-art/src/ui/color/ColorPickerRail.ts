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

// Import Internal Dependencies
import {
  ColorSwatch,
  type ColorChangeDetail
} from "./ColorSwatch.ts";
import { renderIcon } from "../common/icons.ts";
import { iconStyles } from "../common/icon.styles.ts";
import { colorPickerRailStyles } from "./ColorPickerRail.styles.ts";

/**
 * Foreground/background swatches plus swap button.
 * Controlled by props; emits intent events only.
 *
 * @fires {CustomEvent<ColorChangeDetail>} foreground-change
 * @fires {CustomEvent<ColorChangeDetail>} background-change
 * @fires {CustomEvent<void>} swap
 */
@customElement("color-picker-rail")
export class ColorPickerRail extends LitElement {
  static override styles = [
    iconStyles,
    colorPickerRailStyles
  ];

  @property({ attribute: false })
  declare foreground: ColorChangeDetail;

  @property({ attribute: false })
  declare background: ColorChangeDetail;

  #foregroundSwatchElement: ColorSwatch | null = null;
  #backgroundSwatchElement: ColorSwatch | null = null;

  constructor() {
    super();
    this.foreground = {
      hex: "#000000",
      opacity: 1
    };
    this.background = {
      hex: "#ffffff",
      opacity: 1
    };
  }

  override firstUpdated(): void {
    this.#foregroundSwatchElement = this.renderRoot.querySelector<ColorSwatch>(
      "color-swatch.fg"
    );
    this.#backgroundSwatchElement = this.renderRoot.querySelector<ColorSwatch>(
      "color-swatch.bg"
    );
  }

  /**
    * ColorSwatch repaints from setColor();
    * property bindings alone are not enough after firstUpdated().
   */
  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("foreground")) {
      this.#foregroundSwatchElement?.setColor(
        this.foreground.hex,
        this.foreground.opacity
      );
    }

    if (changedProperties.has("background")) {
      this.#backgroundSwatchElement?.setColor(
        this.background.hex,
        this.background.opacity
      );
    }
  }

  #onForegroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    const customEvent = new CustomEvent<ColorChangeDetail>("foreground-change", {
      bubbles: true,
      composed: true,
      detail: event.detail
    });

    this.dispatchEvent(customEvent);
  }

  #onBackgroundChange(
    event: CustomEvent<ColorChangeDetail>
  ): void {
    const customEvent = new CustomEvent<ColorChangeDetail>("background-change", {
      bubbles: true,
      composed: true,
      detail: event.detail
    });

    this.dispatchEvent(customEvent);
  }

  #onSwapClick(): void {
    const customEvent = new CustomEvent("swap", {
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(customEvent);
  }

  #onSwatchOpened(
    event: Event
  ): void {
    const opened = event.composedPath()[0];

    const colorSwatchElements = this.renderRoot.querySelectorAll<ColorSwatch>(
      "color-swatch"
    );
    for (const swatch of colorSwatchElements) {
      swatch !== opened && swatch.close();
    }
  }

  override render() {
    return html`
      <color-swatch
        class="swatch fg"
        part="fg-swatch"
        .color=${this.foreground.hex}
        .opacity=${this.foreground.opacity}
        @color-change=${this.#onForegroundChange}
        @opened=${this.#onSwatchOpened}
      ></color-swatch>
      <color-swatch
        class="swatch bg"
        part="bg-swatch"
        .color=${this.background.hex}
        .opacity=${this.background.opacity}
        @color-change=${this.#onBackgroundChange}
        @opened=${this.#onSwatchOpened}
      ></color-swatch>
      <button
        class="swap-btn"
        part="swap-button"
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
