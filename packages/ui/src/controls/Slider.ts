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
import { NumericInputController } from "../field/NumericInputController.ts";
import { quantize } from "../numeric/entry.ts";
import { unitRatio } from "../numeric/bounds.ts";
import { sliderStyles } from "./Slider.styles.ts";
import { isInputElement } from "../dom.ts";

export type SliderOrientation = "horizontal" | "vertical";

export interface SliderDefaults {
  step: number;
  min: number;
  max: number;
  value: number;
  orientation: SliderOrientation;
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
    value: 0,
    orientation: "horizontal"
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

  @property({ type: String, reflect: true })
  declare orientation: SliderOrientation;

  #readout = new NumericInputController(this, {
    draft: this.draftController,
    step: () => this.step,
    min: () => this.min,
    max: () => this.max,
    value: () => this.concreteValue,
    editable: () => this.editable,
    onInput: (value) => this.emitInput(value),
    onChange: (value) => this.emitChange(value)
  });

  constructor() {
    super();

    this.step = Slider.Defaults.step;
    this.min = Slider.Defaults.min;
    this.max = Slider.Defaults.max;
    this.value = Slider.Defaults.value;
    this.orientation = Slider.Defaults.orientation;
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
        .value=${this.#readout.displayed}
        placeholder=${this.mixed ? MIXED_PLACEHOLDER : ""}
        ?disabled=${this.disabled}
        ?readonly=${this.inputReadonly}
        ?data-pointer-focus=${this.#readout.pointerFocused}
        aria-label=${this.label === "" ? "Value" : `${this.label} value`}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-invalid=${this.displayError === null ? nothing : "true"}
        @input=${this.#readout.onInput}
        @focus=${this.#readout.onFocus}
        @keydown=${this.#readout.onKeyDown}
        @blur=${this.#readout.onBlur}
      >
    `;
  }

  get #progress(): number {
    const value = this.concreteValue;

    return value === undefined ?
      0 :
      unitRatio(value, this.min, this.max);
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
