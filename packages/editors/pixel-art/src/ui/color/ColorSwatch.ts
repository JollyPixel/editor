// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";
import Picker, { type Color } from "vanilla-picker";

// Import Internal Dependencies
import {
  fromPickerColor,
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

/**
 * Swatch button that opens vanilla-picker and emits "color-change".
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
  #picker: Picker | null = null;
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

    this.#picker = new Picker({
      parent: portal.element,
      popup: false,
      alpha: true,
      editor: true,
      editorFormat: "hex",
      color: toRgbaHex(
        this.color,
        this.opacity
      ),
      onChange: this.#onPickerChange,
      onDone: this.#onPickerDone
    });

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

    this.#picker?.destroy?.();
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
      this.#picker.setColor(
        toRgbaHex(hex, opacity),
        true
      );
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
    color: Color
  ): void => {
    const { hex, opacity } = fromPickerColor(color);

    this.color = hex;
    this.opacity = opacity;
    if (this.#buttonElement) {
      this.#buttonElement.style.background = color.rgbaString;
    }

    const customEvent = new CustomEvent<ColorChangeDetail>("color-change", {
      bubbles: true,
      composed: true,
      detail: { hex, opacity }
    });
    this.dispatchEvent(customEvent);
  };

  readonly #onPickerDone = (): void => {
    this.#setOpen(false);
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
