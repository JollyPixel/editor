// Import Third-party Dependencies
import {
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import {
  formatNumber,
  parseNumeric,
  quantize
} from "../numeric/format.ts";
import { sliderStyles } from "./Slider.styles.ts";
import { isInputElement } from "../dom.ts";
import { PointerFocusController } from "../interaction/PointerFocusController.ts";

export interface SliderDefaults {
  step: number;
  min: number;
  max: number;
  value: number;
}

/**
 * Native range control paired with an editable readout.
 */
@customElement("jolly-slider")
export class Slider extends JollyField<number> {
  static readonly Defaults: SliderDefaults = {
    step: 1,
    min: 0,
    max: 100,
    value: 0
  };

  static override styles = [
    ...JollyField.styles,
    sliderStyles
  ];

  @property({ type: Number })
  declare step: number;

  @property({ type: Number })
  declare min: number;

  @property({ type: Number })
  declare max: number;

  #pointerFocus = new PointerFocusController(this);

  constructor() {
    super();

    this.step = Slider.Defaults.step;
    this.min = Slider.Defaults.min;
    this.max = Slider.Defaults.max;
    this.value = Slider.Defaults.value;
  }

  protected renderValue(): TemplateResult {
    const value = this.concreteValue;

    return html`
      <div class="lane" style="--jolly-slider-progress:${this.#progress}">
        <input
          type="range"
          min=${this.min}
          max=${this.max}
          step=${this.step}
          .value=${String(value ?? this.min)}
          ?disabled=${this.disabled}
          aria-label=${this.label === "" ? nothing : this.label}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-valuetext=${this.mixed ? "Mixed" : nothing}
          @input=${this.#onInput}
          @change=${this.#onChange}
        >
      </div>
      <input
        class="readout"
        type="text"
        inputmode="decimal"
        .value=${this.draft ?? this.#displayed}
        placeholder=${this.mixed ? MIXED_PLACEHOLDER : ""}
        ?disabled=${this.disabled}
        ?readonly=${this.inputReadonly}
        ?data-pointer-focus=${this.#pointerFocus.active}
        aria-label=${this.label === "" ? "Value" : `${this.label} value`}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-invalid=${this.displayError === null ? nothing : "true"}
        @input=${this.#onType}
        @focus=${this.#pointerFocus.onFocus}
        @keydown=${this.#onKeyDown}
        @blur=${this.#onBlur}
      >
    `;
  }

  /**
   * Fill ratio between 0 and 1. A mixed value has no thumb position, so it
   * reads as empty rather than as the minimum.
   */
  get #progress(): number {
    const value = this.concreteValue;
    const span = this.max - this.min;
    if (value === undefined || span <= 0) {
      return 0;
    }

    return Math.min(
      1,
      Math.max(0, (value - this.min) / span)
    );
  }

  /**
   * Uses the mixed-value placeholder when no thumb position exists.
   */
  get #displayed(): string {
    const value = this.concreteValue;

    return value === undefined
      ? ""
      : formatNumber(value, this.step);
  }

  #onInput(
    event: Event
  ): void {
    const next = this.#read(event);
    if (next === null) {
      return;
    }

    this.emitInput(next);
  }

  #onChange(
    event: Event
  ): void {
    const next = this.#read(event);
    if (next === null) {
      return;
    }

    this.emitChange(next);
  }

  /**
   * Typing in the readout edits a draft, which the range never sees.
   */
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

    const result = parseNumeric(draft);
    // Blank input cancels the edit.
    if (result === null) {
      this.clearDraft();

      return;
    }

    if (!result.ok) {
      this.setParseError(result.error);

      return;
    }

    this.emitChange(
      quantize(
        result.value,
        this.step,
        this.min,
        this.max
      )
    );
  }

  /**
   * Restore readonly range values without removing the control from tab order.
   */
  #read(
    event: Event
  ): number | null {
    if (!isInputElement(event.target)) {
      return null;
    }

    if (!this.editable) {
      event.target.value = String(
        this.concreteValue ?? this.min
      );

      return null;
    }

    return quantize(
      Number(event.target.value),
      this.step,
      this.min,
      this.max
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-slider": Slider;
  }
}
