// Import Third-party Dependencies
import { formatRgba } from "@jolly-pixel/color";
import {
  LitElement,
  html,
  type PropertyValues
} from "lit";
import {
  customElement,
  property,
  state
} from "lit/decorators.js";
import {
  ensureFontFace
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { colorWithOpacity } from "./pickerChange.ts";
import type { ColorPickerRequest } from "./ColorPickerPopover.ts";
import { colorSwatchStyles } from "./ColorSwatch.styles.ts";

export interface ColorChangeDetail {
  hex: string;
  opacity: number;
}

ensureFontFace();

@customElement("color-swatch")
export class ColorSwatch extends LitElement {
  static override styles = colorSwatchStyles;

  @property({ type: String })
  declare color: string;

  @property({ type: Number })
  declare opacity: number;

  @property({ type: Boolean, reflect: true })
  declare disabled: boolean;

  @state()
  declare _expanded: boolean;

  #swatchElement: HTMLButtonElement | null = null;

  constructor() {
    super();

    this.color = "#000000";
    this.opacity = 1;
    this.disabled = false;
    this._expanded = false;
  }

  override firstUpdated(): void {
    const swatch = this.renderRoot.querySelector<HTMLButtonElement>("button");
    if (swatch === null) {
      throw new Error("ColorSwatch: button element not found");
    }

    this.#swatchElement = swatch;
  }

  override updated(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("disabled") && this.disabled) {
      this.close();
    }
  }

  setColor(
    hex: string,
    opacity = 1
  ): void {
    this.color = hex;
    this.opacity = opacity;
  }

  close(): void {
    this._expanded = false;
    if (this.#swatchElement === null) {
      return;
    }
    this.dispatchEvent(new CustomEvent("color-picker-close", {
      bubbles: true,
      composed: true,
      detail: this.#swatchElement
    }));
  }

  #open(): void {
    if (this._expanded) {
      this.close();

      return;
    }
    const anchor = this.#swatchElement;
    if (anchor === null) {
      return;
    }
    this._expanded = true;
    const request: ColorPickerRequest = {
      anchor,
      color: () => {
        return { hex: this.color, opacity: this.opacity };
      },
      label: "Edit brush color",
      side: "right",
      change: (color) => {
        this.color = color.hex;
        this.opacity = color.opacity;
        this.dispatchEvent(new CustomEvent("color-change", {
          bubbles: true,
          composed: true,
          detail: color
        }));
      },
      close: () => {
        this._expanded = false;
      }
    };
    this.dispatchEvent(new CustomEvent("color-picker-open", {
      bubbles: true,
      composed: true,
      detail: request
    }));
  }

  override render() {
    const color = colorWithOpacity(this.color, this.opacity);

    return html`
      <button
        part="swatch"
        type="button"
        @click=${this.#open}
        title="Color"
        aria-haspopup="dialog"
        aria-expanded=${String(this._expanded)}
        ?disabled=${this.disabled}
        style="background:${formatRgba(color)}"
      ></button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-swatch": ColorSwatch;
  }
}
