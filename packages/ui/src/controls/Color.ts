// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import { customElement } from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import { colorStyles } from "./Color.styles.ts";
import { normalizeHex } from "./hex.ts";
import { isInputElement } from "../dom.ts";
import { PointerFocusController } from "../interaction/PointerFocusController.ts";

export interface ColorDefaults {
  value: string;
}

/**
 * Combines a native picker with a draftable hex field.
 */
@customElement("jolly-color")
export class Color extends JollyField<string> {
  static readonly Defaults: ColorDefaults = {
    value: "#000000"
  };

  static override styles = [
    ...JollyField.styles,
    colorStyles
  ];

  #pointerFocus = new PointerFocusController(this);

  constructor() {
    super();

    this.value = Color.Defaults.value;
  }

  protected renderValue(): TemplateResult {
    const swatch = this.concreteValue;

    return html`
      <span class="swatch">
        <span class="swatch-face" aria-hidden="true" style="background:${swatch ?? Color.Defaults.value}"></span>
        <input
          type="color"
          class="swatch-input"
          aria-label="Pick a colour"
          .value=${swatch ?? Color.Defaults.value}
          ?disabled=${this.disabled || !this.editable}
          @input=${this.#onPick}
        >
      </span>
      <input
        type="text"
        class="hex"
        spellcheck="false"
        aria-label="Hex value"
        .value=${this.draft ?? swatch ?? ""}
        placeholder=${this.mixed ? MIXED_PLACEHOLDER : Color.Defaults.value}
        ?disabled=${this.disabled}
        ?readonly=${this.inputReadonly}
        ?data-pointer-focus=${this.#pointerFocus.active}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-description=${this.lockDescription}
        aria-invalid=${this.displayError === null ? nothing : "true"}
        @input=${this.#onType}
        @focus=${this.#pointerFocus.onFocus}
        @keydown=${this.#onKeyDown}
        @blur=${this.#onBlur}
      >
    `;
  }

  #onPick(
    event: Event
  ): void {
    if (!isInputElement(event.target) || !this.editable) {
      return;
    }

    this.emitChange(event.target.value);
  }

  #onType(
    event: Event
  ): void {
    if (!isInputElement(event.target)) {
      return;
    }

    this.setDraft(event.target.value);
    this.setParseError(null);
  }

  #onKeyDown(
    event: KeyboardEvent
  ): void {
    this.#pointerFocus.onKeyDown();

    if (event.key === "Enter") {
      this.#commit();
    }
    else if (event.key === "Escape") {
      event.stopPropagation();
      this.clearDraft();
    }
  }

  #onBlur(): void {
    this.#pointerFocus.onBlur();
    this.#commit();
  }

  #commit(): void {
    const draft = this.draft;
    if (draft === null || !this.editable) {
      return;
    }

    const normalized = normalizeHex(draft);
    if (normalized === null) {
      this.setParseError(`"${draft.trim()}" is not a hex colour`);

      return;
    }

    this.emitChange(normalized);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-color": Color;
  }
}
