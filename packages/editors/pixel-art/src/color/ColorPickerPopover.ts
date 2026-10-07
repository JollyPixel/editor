// Import Third-party Dependencies
import {
  LitElement,
  html
} from "lit";
import {
  customElement,
  state
} from "lit/decorators.js";
import {
  FieldBinding,
  PopoverController,
  type PopoverSide
} from "@jolly-pixel/ui";
import { formatHex } from "@jolly-pixel/color";

// Import Internal Dependencies
import {
  parseColorChange,
  colorWithOpacity
} from "./pickerChange.ts";
import type { ColorChangeDetail } from "./ColorSwatch.ts";
import { colorPickerPopoverStyles } from "./ColorPickerPopover.styles.ts";

export interface ColorPickerRequest {
  anchor: HTMLButtonElement;
  color(): ColorChangeDetail;
  label: string;
  side: PopoverSide;
  change(color: ColorChangeDetail, last: boolean): void;
  close(): void;
}

@customElement("color-picker-popover")
export class ColorPickerPopover extends LitElement {
  static override styles = colorPickerPopoverStyles;

  @state()
  declare _value: string;

  @state()
  declare _label: string;

  #request: ColorPickerRequest | null = null;
  #anchor: HTMLButtonElement | null = null;
  #draft = false;
  #picker = new FieldBinding(this, {
    read: () => this._value,
    write: (value: string, last: boolean) => {
      const request = this.#request;
      if (request === null || !this.#element()?.matches(":popover-open")) {
        return;
      }
      const color = parseColorChange(value);
      if (color !== null) {
        this._value = value;
        this.#draft = !last;
        request.change(color, last);
      }
    }
  });
  #popup = new PopoverController(this, {
    anchor: () => this.#anchor,
    popover: () => this.#element(),
    side: () => this.#request?.side ?? "right"
  });

  constructor() {
    super();
    this._value = "#000000ff";
    this._label = "Edit color";
  }

  open(
    request: ColorPickerRequest
  ): void {
    this.close();
    this.#request = request;
    this.#anchor = request.anchor;
    this.#draft = false;
    this.refresh();
    this._label = request.label;
    void this.updateComplete.then(() => {
      if (this.#request === request && this.isConnected) {
        this.#popup.show();
      }
    });
  }

  close(
    anchor?: HTMLButtonElement
  ): void {
    if (anchor !== undefined && anchor !== this.#anchor) {
      return;
    }
    this.#popup.hide();
    this.#finish();
  }

  refresh(): void {
    if (this.#request === null || this.#draft) {
      return;
    }
    const color = this.#request.color();
    this._value = formatHex(colorWithOpacity(color.hex, color.opacity), true);
  }

  override disconnectedCallback(): void {
    this.close();
    super.disconnectedCallback();
  }

  override render() {
    return html`
      <div
        class="popover"
        popover
        role="dialog"
        aria-label=${this._label}
        @beforetoggle=${(event: ToggleEvent) => {
          this.#popup.onBeforeToggle(event);
          if (event.newState === "closed") {
            this.#finish();
          }
        }}
        @toggle=${this.#popup.onToggle}
      >
        <jolly-color-picker
          alpha
          .value=${this.#picker.value}
          @jolly-input=${this.#picker.input}
          @jolly-change=${this.#picker.commit}
        ></jolly-color-picker>
        <button type="button" class="done" @click=${() => this.close()}>
          Done
        </button>
      </div>
    `;
  }

  #element(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>(".popover");
  }

  #finish(): void {
    const request = this.#request;
    this.#request = null;
    this.#draft = false;
    request?.close();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "color-picker-popover": ColorPickerPopover;
  }

  interface HTMLElementEventMap {
    "color-picker-open": CustomEvent<ColorPickerRequest>;
    "color-picker-close": CustomEvent<HTMLButtonElement>;
  }
}
