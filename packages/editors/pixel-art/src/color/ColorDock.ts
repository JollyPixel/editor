// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import { FieldBinding } from "@jolly-pixel/ui";
import { ColorPalette } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { pickerSource } from "./pickerChange.ts";
import "./ColorPaletteGrid.ts";
import { colorDockStyles } from "./ColorDock.styles.ts";

// CONSTANTS
const kDefaultPalette = ColorPalette.create();

@customElement("color-dock")
export class ColorDock extends LitElement {
  static override styles = colorDockStyles;

  @property({ type: String })
  declare color: string;

  @property({ type: Number })
  declare opacity: number;

  @property({ attribute: false })
  declare palette: ColorPalette | null;

  @property({ attribute: false })
  declare selected: number | null;

  @property({ attribute: false })
  declare editing: number | null;

  @property({ type: Boolean, attribute: "palette-locked" })
  declare paletteLocked: boolean;

  #picker = new FieldBinding(this, pickerSource(this));

  constructor() {
    super();

    this.color = "#000000";
    this.opacity = 1;
    this.palette = null;
    this.selected = null;
    this.editing = null;
    this.paletteLocked = false;
  }

  override render() {
    return html`
      <color-palette-grid
        part="palette"
        .palette=${this.palette ?? kDefaultPalette}
        .selected=${this.selected}
        .editing=${this.editing}
        .disabled=${this.palette === null}
        .locked=${this.paletteLocked}
      ></color-palette-grid>
      <jolly-color-picker
        layout="wide"
        alpha
        part="picker"
        .value=${this.#picker.value}
        @jolly-input=${this.#picker.input}
        @jolly-change=${this.#picker.commit}
      ></jolly-color-picker>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-dock": ColorDock;
  }
}
