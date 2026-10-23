// Import Third-party Dependencies
import {
  formatHex8,
  formatRgba8
} from "@jolly-pixel/color";
import { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";
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
import { colorPaletteGridStyles } from "./ColorPaletteGrid.styles.ts";

export interface PaletteRampDetail {
  from: number;
  to: number;
}

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

  @property({ type: Boolean })
  declare locked: boolean;

  constructor() {
    super();
    this.palette = ColorPalette.create();
    this.selected = null;
    this.editing = null;
    this.disabled = false;
    this.locked = false;
  }

  override render() {
    const hint = this.locked ?
      "click to use" :
      "click to use, shift click to ramp from the selected color, double click or F2 to edit";

    return html`
      <div class="grid" role="group" aria-label="Document color palette">
        ${this.palette.toJSON().map((color, index) => html`
            <button
              type="button"
              part="palette-slot"
              aria-label=${`Palette color ${index + 1}`}
              aria-pressed=${String(this.selected === index)}
              aria-haspopup=${this.locked ? nothing : "dialog"}
              aria-expanded=${this.locked ? nothing : String(this.editing === index)}
              title=${`${formatHex8(color, true)}: ${hint}`}
              ?disabled=${this.disabled}
              @click=${(event: MouseEvent) => this.#select(event, index)}
              @dblclick=${(event: MouseEvent) => this.#edit(event, index)}
              @keydown=${(event: KeyboardEvent) => {
                if (event.key === "F2") {
                  event.preventDefault();
                  this.#edit(event, index);
                }
              }}
            ><span style=${`background:${formatRgba8(color)}`}></span></button>
          `)}
      </div>
    `;
  }

  #select(
    event: MouseEvent,
    index: number
  ): void {
    const from = this.selected;
    if (event.shiftKey && !this.locked && from !== null && from !== index) {
      this.#dispatch<PaletteRampDetail>("palette-ramp", {
        from,
        to: index
      });

      return;
    }

    this.#dispatch("palette-select", index);
  }

  #edit(
    event: Event,
    index: number
  ): void {
    if (!this.locked && event.currentTarget instanceof HTMLButtonElement) {
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
