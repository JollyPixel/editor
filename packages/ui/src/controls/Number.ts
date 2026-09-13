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
    /**
     * Number fields are unbounded by default.
     */
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

  #input = new NumericInputController(this, {
    draft: this.draftController,
    step: () => this.step,
    min: () => this.min,
    max: () => this.max,
    value: () => this.concreteValue,
    editable: () => this.editable,
    onInput: (value) => this.emitInput(value),
    onChange: (value) => this.emitChange(value),
    scrubTarget: () => this.renderRoot.querySelector(".scrub-handle")
  });

  constructor() {
    super();

    this.step = NumberField.Defaults.step;
    this.min = NumberField.Defaults.min;
    this.max = NumberField.Defaults.max;
    this.value = NumberField.Defaults.value;
  }

  protected override get scrubbable(): boolean {
    return this.editable && !this.mixed;
  }

  protected renderValue(): TemplateResult {
    return html`
      <div class="wrap">
        <span class="scrub-handle" aria-hidden="true"></span>
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
