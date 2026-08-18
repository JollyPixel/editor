// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import {
  ensureFontFace,
  detailOf,
  PopoverController,
  type JollyChangeDetail
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  splitRgbaHex,
  toRgbaHex,
  toRgbaString
} from "../../utils/colors.ts";
import { assertElement } from "../../utils/dom.ts";
import { colorSwatchStyles } from "./ColorSwatch.styles.ts";

export interface ColorChangeDetail {
  hex: string;
  opacity: number;
}

// Registers the bundled Roboto Mono face on `document`: the popover renders
// in the top layer (native Popover API), still inside this shadow tree, but
// "@font-face" declared inside a shadow root is ignored by the browser.
ensureFontFace();

/**
 * Swatch button that opens a jolly-color-picker popover and emits "color-change".
 *
 * @fires {CustomEvent<ColorChangeDetail>} color-change
 * @fires {CustomEvent<void>} opened
 */
@customElement("color-swatch")
export class ColorSwatch extends LitElement {
  static override styles = colorSwatchStyles;

  @property({ type: String })
  declare color: string;

  @property({ type: Number })
  declare opacity: number;

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
    const detail = detailOf<JollyChangeDetail<string>>(event);
    if (detail === null) {
      return;
    }

    const { hex, opacity } = splitRgbaHex(detail.value);

    this.color = hex;
    this.opacity = opacity;

    const customEvent = new CustomEvent<ColorChangeDetail>("color-change", {
      bubbles: true,
      composed: true,
      detail: { hex, opacity }
    });
    this.dispatchEvent(customEvent);
  };

  override render() {
    return html`
      <button
        part="swatch"
        popovertarget="picker"
        title="Color"
        aria-haspopup="dialog"
        aria-expanded=${this.#popup.open}
        style="background:${toRgbaString(this.color, this.opacity)}"
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
          .value=${toRgbaHex(this.color, this.opacity)}
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
