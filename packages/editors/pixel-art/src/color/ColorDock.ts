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

// Import Internal Dependencies
import { pickerSource } from "./pickerChange.ts";
import { colorDockStyles } from "./ColorDock.styles.ts";

@customElement("color-dock")
export class ColorDock extends LitElement {
  static override styles = colorDockStyles;

  @property({ type: String })
  declare color: string;

  @property({ type: Number })
  declare opacity: number;

  #picker = new FieldBinding(this, pickerSource(this));

  constructor() {
    super();

    this.color = "#000000";
    this.opacity = 1;
  }

  override render() {
    return html`
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
