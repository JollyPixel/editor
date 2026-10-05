// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { live } from "lit/directives/live.js";

// Import Internal Dependencies
import {
  type ColorChangeDetail
} from "./ColorSwatch.ts";
import "./ColorSwatch.ts";
import { renderIcon } from "../shared/icons.ts";
import { iconStyles } from "../shared/icon.styles.ts";
import { colorPickerRailStyles } from "./ColorPickerRail.styles.ts";

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

  @property({ type: Boolean, reflect: true })
  declare docked: boolean;

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
    this.docked = false;
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

  #onDockClick(): void {
    const customEvent = new CustomEvent("dock-toggle", {
      bubbles: true,
      composed: true
    });

    this.dispatchEvent(customEvent);
  }

  override render() {
    return html`
      <div class="swatches">
        <color-swatch
          class="swatch fg"
          part="fg-swatch"
          .color=${live(this.foreground.hex)}
          .opacity=${live(this.foreground.opacity)}
          ?disabled=${this.docked}
          @color-change=${this.#onForegroundChange}
        ></color-swatch>
        <color-swatch
          class="swatch bg"
          part="bg-swatch"
          .color=${live(this.background.hex)}
          .opacity=${live(this.background.opacity)}
          ?disabled=${this.docked}
          @color-change=${this.#onBackgroundChange}
        ></color-swatch>
        <button
          class="swap-btn"
          part="swap-button"
          aria-label="Swap foreground and background colors"
          ?disabled=${this.docked}
          @click=${this.#onSwapClick}
        >${renderIcon("swap")}</button>
      </div>
      <button
        class="dock-btn"
        part="dock-button"
        title="Docked color picker"
        aria-label="Docked color picker"
        aria-pressed=${this.docked ? "true" : "false"}
        @click=${this.#onDockClick}
      >${renderIcon("dockPicker")}</button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-picker-rail": ColorPickerRail;
  }
}
