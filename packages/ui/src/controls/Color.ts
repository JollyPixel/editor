// Import Third-party Dependencies
import { formatHex } from "@jolly-pixel/color";
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property,
  query
} from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import { parseFieldColor } from "../color/draft.ts";
import { colorStyles } from "./Color.styles.ts";
import {
  readDetail
} from "../dom.ts";
import type { JollyChangeDetail } from "../field/events.ts";
import { PointerFocusController } from "../field/PointerFocusController.ts";
import { PopoverController } from "../field/PopoverController.ts";

import {
  ColorPicker
} from "./ColorPicker.ts";

export interface ColorDefaults {
  value: string;
}

@customElement("jolly-color")
export class Color extends JollyField<string> {
  static readonly Defaults: ColorDefaults = {
    value: "#000000"
  };

  static override styles = [
    ...JollyField.styles,
    colorStyles
  ];

  @property({ type: Boolean, reflect: true })
  declare alpha: boolean;

  @query(".swatch")
  declare _swatch: HTMLButtonElement;

  @query(".popover")
  declare _popover: HTMLElement;

  @query(".picker")
  declare _picker: ColorPicker;

  @query(".hex")
  declare _hex: HTMLInputElement;

  #pointerFocus = new PointerFocusController(this);
  #valueAtOpen: string | null = null;

  #popup = new PopoverController(this, {
    anchor: () => this._swatch,
    popover: () => this._popover,
    onOpen: () => {
      this.#valueAtOpen = this.concreteValue ?? null;
      this._picker.focus();
    },
    onClose: () => {
      this.#valueAtOpen = null;
    },
    onCancel: (event) => {
      if (!event.composedPath().includes(this._hex)) {
        this.#revert();
      }
    }
  });

  constructor() {
    super();

    this.value = Color.Defaults.value;
    this.alpha = false;
  }

  protected override valuesEqual(
    a: string,
    b: string
  ): boolean {
    return this.#normalize(a) === this.#normalize(b);
  }

  #normalize(
    input: string
  ): string {
    const parsed = parseFieldColor(input ?? "");

    return parsed === null
      ? input
      : formatHex(parsed, this.alpha);
  }

  protected renderValue(): TemplateResult {
    const swatch = this.concreteValue;

    return html`
      <button
        class="swatch"
        type="button"
        popovertarget="picker"
        title="Pick a colour"
        aria-label="Pick a colour"
        aria-haspopup="dialog"
        aria-expanded=${this.#popup.open}
        ?disabled=${this.disabled}
      >
        ${swatch === undefined
          ? nothing
          : html`<span class="swatch-face" style="--jolly-swatch-color:${swatch}"></span>`}
      </button>
      <input
        type="text"
        class="hex"
        spellcheck="false"
        aria-label="Hex value"
        .value=${this.draftController.draft ?? swatch ?? ""}
        placeholder=${this.mixed ? MIXED_PLACEHOLDER : this.#placeholder}
        ?disabled=${this.disabled}
        ?readonly=${this.inputReadonly}
        ?data-pointer-focus=${this.#pointerFocus.active}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-description=${this.lockDescription}
        aria-invalid=${this.displayError === null ? nothing : "true"}
        @input=${this.#onInput}
        @focus=${this.#pointerFocus.onFocus}
        @keydown=${this.#onKeyDown}
        @blur=${this.#onBlur}
      >
      ${this.#renderPopover()}
    `;
  }

  get #placeholder(): string {
    return this.alpha
      ? `${Color.Defaults.value}ff`
      : Color.Defaults.value;
  }

  #renderPopover(): TemplateResult {
    return html`
      <div
        class="popover overlay-motion"
        id="picker"
        popover
        @beforetoggle=${this.#popup.onBeforeToggle}
        @toggle=${this.#popup.onToggle}
      >
        <jolly-color-picker
          class="picker"
          .value=${this.concreteValue ?? Color.Defaults.value}
          ?alpha=${this.alpha}
          .hexInput=${false}
          ?readonly=${!this.editable}
          @jolly-input=${this.#onPickerInput}
          @jolly-change=${this.#onPickerChange}
        ></jolly-color-picker>
      </div>
    `;
  }

  #revert(): void {
    const opening = this.#valueAtOpen;
    if (
      opening === null ||
      !this.editable
    ) {
      return;
    }

    if (!this.valuesEqual(opening, this.concreteValue ?? "")) {
      this.emitChange(opening);
    }
  }

  #onPickerInput(
    event: Event
  ): void {
    const next = this.#readPicker(event);
    if (next !== null) {
      this.emitInput(next);
    }
  }

  #onPickerChange(
    event: Event
  ): void {
    const next = this.#readPicker(event);
    if (next !== null) {
      this.emitChange(next);
    }
  }

  #readPicker(
    event: Event
  ): string | null {
    event.stopPropagation();

    const detail = readDetail<JollyChangeDetail<string>>(event);
    if (detail === null || !this.editable) {
      return null;
    }

    return detail.value;
  }

  #onInput(
    event: Event
  ): void {
    this.draftController.onInput(event);
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    this.#pointerFocus.onKeyDown();

    this.draftController.onKeyDown(
      event,
      () => this.#commit()
    );
  }

  #onBlur(): void {
    this.#pointerFocus.onBlur();
    this.#commit();
  }

  #commit(): void {
    this.commitDraft((draft) => {
      const parsed = parseFieldColor(draft);
      if (parsed === null) {
        return {
          ok: false,
          error: `"${draft.trim()}" is not a hex colour`
        };
      }

      return {
        ok: true,
        value: formatHex(
          parsed,
          this.alpha
        )
      };
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-color": Color;
  }
}
