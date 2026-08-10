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
  quantize
} from "../numeric/format.ts";
import { sliderStyles } from "./Slider.styles.ts";
import { isInputElement } from "../dom.ts";

export interface SliderDefaults {
  step: number;
  min: number;
  max: number;
  value: number;
}

/**
 * Native range control with a readout.
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
      <input
        type="range"
        min=${this.min}
        max=${this.max}
        step=${this.step}
        .value=${String(value ?? this.min)}
        ?disabled=${this.disabled}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-description=${this.lockDescription}
        aria-valuetext=${this.mixed ? "Mixed" : nothing}
        @input=${this.#onInput}
        @change=${this.#onChange}
      >
      <span class="readout">${this.#readout}</span>
    `;
  }

  /**
   * Uses the mixed-value placeholder when no thumb position exists.
   */
  get #readout(): string {
    const value = this.concreteValue;

    return value === undefined
      ? MIXED_PLACEHOLDER
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
