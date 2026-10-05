// Import Third-party Dependencies
import {
  formatHex,
  formatRgba,
  fromRGBA8
} from "@jolly-pixel/color";
import { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { colorPaletteGridStyles } from "./ColorPaletteGrid.styles.ts";

export interface PaletteEditDetail {
  index: number;
  anchor: HTMLButtonElement;
}

@customElement("color-palette-grid")
export class ColorPaletteGrid extends LitElement {
  static override styles = colorPaletteGridStyles;

  @property({ attribute: false })
  declare palette: ColorPalette;

  @property({ attribute: false })
  declare selected: number | null;

  @property({ attribute: false })
  declare editing: number | null;

  @property({ type: Boolean })
  declare disabled: boolean;

  constructor() {
    super();
    this.palette = ColorPalette.create();
    this.selected = null;
    this.editing = null;
    this.disabled = false;
  }

  override render() {
    return html`
      <div class="grid" role="group" aria-label="Document color palette">
        ${this.palette.toJSON().map((color, index) => {
          const rgba = fromRGBA8(color);

          return html`
            <button
              type="button"
              part="palette-slot"
              aria-label=${`Palette color ${index + 1}`}
              aria-pressed=${String(this.selected === index)}
              aria-haspopup="dialog"
              aria-expanded=${String(this.editing === index)}
              title=${`${formatHex(rgba, true)}: click to use, double click or F2 to edit`}
              ?disabled=${this.disabled}
              @click=${() => this.#dispatch("palette-select", index)}
              @dblclick=${(event: MouseEvent) => this.#edit(event, index)}
              @keydown=${(event: KeyboardEvent) => {
                if (event.key === "F2") {
                  event.preventDefault();
                  this.#edit(event, index);
                }
              }}
            ><span style=${`background:${formatRgba(rgba)}`}></span></button>
          `;
        })}
      </div>
    `;
  }

  #edit(
    event: Event,
    index: number
  ): void {
    if (event.currentTarget instanceof HTMLButtonElement) {
      this.#dispatch<PaletteEditDetail>("palette-edit", {
        index,
        anchor: event.currentTarget
      });
    }
  }

  #dispatch<TDetail>(
    type: string,
    detail: TDetail
  ): void {
    this.dispatchEvent(new CustomEvent(type, {
      bubbles: true,
      composed: true,
      detail
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-palette-grid": ColorPaletteGrid;
  }
}
