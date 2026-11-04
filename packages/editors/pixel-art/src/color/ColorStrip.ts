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
            style=${`--swatch-color:${formatRgba(colorWithOpacity(color.hex, color.opacity))}`}
            @click=${(event: MouseEvent) => this.#pick(event, color)}
          ></button>
        `)}
      </div>
    `;
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
