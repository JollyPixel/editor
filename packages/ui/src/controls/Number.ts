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
import { numberStyles } from "./Number.styles.ts";

export interface NumberFieldDefaults {
  step: number;
  min: number;
  max: number;
  value: number;
}

@customElement("jolly-number")
export class NumberField extends JollyField<number> {
  static readonly Defaults: NumberFieldDefaults = {
    step: 1,
    min: Number.NEGATIVE_INFINITY,
    max: Number.POSITIVE_INFINITY,
    value: 0
  };

  static override styles = [
    ...JollyField.styles,
    numberStyles
  ];

  @property({ type: Number })
  declare step: number;

  @property({ type: Number })
  declare min: number;

  @property({ type: Number })
  declare max: number;

  @property({
    type: Boolean,
    attribute: "no-steppers"
  })
  declare noSteppers: boolean;

  #input = new NumericInputController(this, {
    draft: this.draftController,
    step: () => this.step,
    min: () => this.min,
    max: () => this.max,
    value: () => this.concreteValue,
    editable: () => this.editable,
    onInput: (value) => this.emitInput(value),
    onChange: (value) => this.emitChange(value),
    scrub: {
      target: () => this.renderRoot.querySelector(".scrub-handle")
    }
  });

  constructor() {
    super();

    this.step = NumberField.Defaults.step;
    this.min = NumberField.Defaults.min;
    this.max = NumberField.Defaults.max;
    this.value = NumberField.Defaults.value;
    this.noSteppers = false;
  }

  protected override get scrubbable(): boolean {
    return this.editable && !this.mixed;
  }

  #renderSteppers(): TemplateResult | typeof nothing {
    const value = this.concreteValue;
    if (this.noSteppers || !this.scrubbable || value === undefined) {
      return nothing;
    }

    return html`
      <span class="steppers" aria-hidden="true">
        <span
          class="stepper"
          data-direction="up"
          ?data-at-bound=${value >= this.max}
          @pointerdown=${this.#input.stepper.onIncrementPress}
        ></span>
        <span
          class="stepper"
          data-direction="down"
          ?data-at-bound=${value <= this.min}
          @pointerdown=${this.#input.stepper.onDecrementPress}
        ></span>
      </span>
    `;
  }

  protected renderValue(): TemplateResult {
    return html`
      <div class="wrap">
        <span class="scrub-handle" aria-hidden="true"></span>
        ${this.#renderSteppers()}
        <input
          type="text"
          inputmode="decimal"
          .value=${this.#input.displayed}
          placeholder=${this.mixed ? MIXED_PLACEHOLDER : ""}
          ?disabled=${this.disabled}
          ?readonly=${this.inputReadonly}
          ?data-pointer-focus=${this.#input.pointerFocused}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          @input=${this.#input.onInput}
          @focus=${this.#input.onFocus}
          @keydown=${this.#input.onKeyDown}
          @blur=${this.#input.onBlur}
        >
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-number": NumberField;
  }
}
