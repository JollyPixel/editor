// Import Third-party Dependencies
import {
  formatHex,
  parseColor,
  type RGBA
} from "@jolly-pixel/color";
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import { colorChangeFromPicker } from "./pickerChange.ts";
import { colorDockStyles } from "./ColorDock.styles.ts";

// CONSTANTS
const kBlack: RGBA = {
  r: 0,
  g: 0,
  b: 0,
  a: 1
};

@customElement("color-dock")
export class ColorDock extends LitElement {
  static override styles = colorDockStyles;

  @property({ type: String })
  declare color: string;

  @property({ type: Number })
  declare opacity: number;

  constructor() {
    super();

    this.color = "#000000";
    this.opacity = 1;
  }

  readonly #onPickerChange = (
    event: Event
  ): void => {
    const detail = colorChangeFromPicker(event);
    if (detail === null) {
      return;
    }

    this.color = detail.hex;
    this.opacity = detail.opacity;

    const customEvent = new CustomEvent<ColorChangeDetail>("color-change", {
      bubbles: true,
      composed: true,
      detail
    });
    this.dispatchEvent(customEvent);
  };

  get #value(): string {
    const parsed = parseColor(this.color) ?? kBlack;

    return formatHex(
      {
        ...parsed,
        a: this.opacity
      },
      true
    );
  }

  override render() {
    return html`
      <jolly-color-picker
        layout="wide"
        alpha
        part="picker"
        .value=${this.#value}
        @jolly-input=${this.#onPickerChange}
        @jolly-change=${this.#onPickerChange}
      ></jolly-color-picker>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-dock": ColorDock;
  }
}
