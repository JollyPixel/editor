// Import Third-party Dependencies
import { formatHex } from "@jolly-pixel/color";
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import {
  applyPickerChange,
  colorWithOpacity
} from "./pickerChange.ts";
import { colorDockStyles } from "./ColorDock.styles.ts";

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
    applyPickerChange(this, event);
  };

  override render() {
    return html`
      <jolly-color-picker
        layout="wide"
        alpha
        part="picker"
        .value=${formatHex(colorWithOpacity(this.color, this.opacity), true)}
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
