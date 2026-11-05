// Import Third-party Dependencies
import { formatRgba } from "@jolly-pixel/color";
import {
  LitElement,
  html,
  nothing
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import type { StripPickDetail } from "./PaletteAction.ts";
import { colorWithOpacity } from "./pickerChange.ts";
import { colorStripStyles } from "./ColorStrip.styles.ts";
import { formatSwatchRing } from "./swatchRing.ts";

@customElement("color-strip")
export class ColorStrip extends LitElement {
  static override styles = colorStripStyles;

  @property({ type: String })
  declare label: string;

  @property({ attribute: false })
  declare colors: readonly ColorChangeDetail[];

  @property({ attribute: false })
  declare current: number | null;

  @property({ type: Boolean })
  declare addable: boolean;

  constructor() {
    super();
    this.label = "";
    this.colors = [];
    this.current = null;
    this.addable = false;
  }

  override render() {
    const hint = this.addable ? "click to use, shift click to add to the palette" : "click to use";

    return html`
      <span class="label" id="label">${this.label}</span>
      <div class="swatches" role="group" aria-labelledby="label">
        ${this.colors.map((color, index) => html`
          <button
            type="button"
            part="strip-swatch"
            aria-label=${`${this.label} ${index + 1}: ${color.hex}`}
            aria-current=${this.current === index ? "true" : nothing}
            title=${`${color.hex}: ${hint}`}
            style=${this.#swatchStyle(color, index)}
            @click=${(event: MouseEvent) => this.#pick(event, color)}
          ></button>
        `)}
      </div>
    `;
  }

  #swatchStyle(
    color: ColorChangeDetail,
    index: number
  ): string {
    const rgba = colorWithOpacity(color.hex, color.opacity);
    const fill = `--swatch-color:${formatRgba(rgba)}`;

    return this.current === index ?
      `${fill};--swatch-ring:${formatSwatchRing(rgba)}` :
      fill;
  }

  #pick(
    event: MouseEvent,
    color: ColorChangeDetail
  ): void {
    this.dispatchEvent(new CustomEvent<StripPickDetail>("strip-pick", {
      bubbles: true,
      composed: true,
      detail: {
        hex: color.hex,
        opacity: color.opacity,
        add: this.addable && event.shiftKey
      }
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-strip": ColorStrip;
  }
}
