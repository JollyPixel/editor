// Import Third-party Dependencies
import {
  formatHex,
  formatRgba
} from "@jolly-pixel/color";
import {
  LitElement,
  html,
  type PropertyValues
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import {
  ensureFontFace,
  PopoverController
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { assertElement } from "../shared/dom.ts";
import {
  applyPickerChange,
  colorWithOpacity
} from "./pickerChange.ts";
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

  #swatchElement: HTMLButtonElement | null = null;
  #popoverElement: HTMLElement | null = null;

  #popup = new PopoverController(this, {
    anchor: () => this.#swatchElement,
    popover: () => this.#popoverElement,
    side: "right",
    onOpen: () => {
      const event = new CustomEvent("opened", {
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    }
  });

  constructor() {
    super();

    this.color = "#000000";
    this.opacity = 1;
    this.disabled = false;
  }

  override firstUpdated(): void {
    this.#swatchElement = assertElement(
      this.renderRoot.querySelector<HTMLButtonElement>("button"),
      "ColorSwatch: button element not found"
    );
    this.#popoverElement = assertElement(
      this.renderRoot.querySelector<HTMLElement>(".popover"),
      "ColorSwatch: popover element not found"
    );
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
    this.#popup.hide();
  }

  readonly #onPickerChange = (
    event: Event
  ): void => {
    applyPickerChange(this, event);
  };

  override render() {
    const color = colorWithOpacity(this.color, this.opacity);

    return html`
      <button
        part="swatch"
        popovertarget="picker"
        title="Color"
        aria-haspopup="dialog"
        aria-expanded=${this.#popup.open}
        ?disabled=${this.disabled}
        style="background:${formatRgba(color)}"
      ></button>
      <div
        class="popover"
        id="picker"
        popover
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
      >
        <jolly-color-picker
          alpha
          .value=${formatHex(color, true)}
          @jolly-input=${this.#onPickerChange}
          @jolly-change=${this.#onPickerChange}
        ></jolly-color-picker>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-swatch": ColorSwatch;
  }
}
