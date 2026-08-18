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
  ColorPicker,
  detailOf,
  ensureFontFace,
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
import { ColorSwatchPortal } from "./ColorSwatchPortal.ts";

export interface ColorChangeDetail {
  hex: string;
  opacity: number;
}

// Registers the bundled Roboto Mono face on `document`, so the picker
// portal (a light-DOM element with no @jolly-pixel/ui scope host) can
// reference it by name instead of falling back to the page's font.
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

  #open = false;
  #buttonElement: HTMLButtonElement | null = null;
  #picker: ColorPicker | null = null;
  #portal: ColorSwatchPortal | null = null;

  constructor() {
    super();

    this.color = "#000000";
    this.opacity = 1;
  }

  override firstUpdated() {
    const swatchElement = assertElement(
      this.renderRoot.querySelector<HTMLButtonElement>("button"),
      "ColorSwatch: button element not found"
    );
    this.#buttonElement = swatchElement;
    swatchElement.style.background = toRgbaString(
      this.color,
      this.opacity
    );

    const portal = new ColorSwatchPortal({
      anchor: swatchElement,
      onDismiss: () => this.#setOpen(false)
    });
    this.#portal = portal;

    const picker = document.createElement("jolly-color-picker");
    picker.alpha = true;
    picker.value = toRgbaHex(this.color, this.opacity);
    picker.addEventListener("jolly-input", this.#onPickerChange);
    picker.addEventListener("jolly-change", this.#onPickerChange);
    portal.element.appendChild(picker);
    this.#picker = picker;

    swatchElement.addEventListener(
      "click",
      this.#onSwatchClick
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this.#buttonElement?.removeEventListener(
      "click",
      this.#onSwatchClick
    );

    this.#picker?.removeEventListener("jolly-input", this.#onPickerChange);
    this.#picker?.removeEventListener("jolly-change", this.#onPickerChange);
    this.#picker = null;
    this.#portal?.destroy();
    this.#portal = null;
  }

  setColor(
    hex: string,
    opacity = 1
  ): void {
    this.color = hex;
    this.opacity = opacity;

    if (this.#picker) {
      this.#picker.value = toRgbaHex(hex, opacity);
    }
    if (this.#buttonElement) {
      this.#buttonElement.style.background = toRgbaString(
        this.color,
        this.opacity
      );
    }
  }

  close(): void {
    this.#setOpen(false);
  }

  #setOpen(
    open: boolean
  ): void {
    this.#open = open;
    if (!this.#portal) {
      throw new Error("ColorSwatch: portal not initialized");
    }

    if (open) {
      this.#portal.open();

      const event = new CustomEvent("opened", {
        bubbles: true,
        composed: true
      });
      this.dispatchEvent(event);
    }
    else {
      this.#portal.close();
    }
    this.requestUpdate();
  }

  readonly #onSwatchClick = (
    event: MouseEvent
  ): void => {
    event.stopPropagation();
    this.#setOpen(!this.#open);
  };

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
    if (this.#buttonElement) {
      this.#buttonElement.style.background = toRgbaString(hex, opacity);
    }

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
        title="Color"
        aria-haspopup="dialog"
        aria-expanded=${this.#open}
      ></button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-swatch": ColorSwatch;
  }
}
