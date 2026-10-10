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
import { unitRatio } from "../numeric/bounds.ts";
import { Track } from "../numeric/track.ts";
import { spinSliderStyles } from "./SpinSlider.styles.ts";

// CONSTANTS
const kDragThreshold = 3;

export interface SpinSliderDefaults {
  step: number;
  min: number;
  max: number;
  value: number;
}

@customElement("jolly-spin-slider")
export class SpinSlider extends JollyField<number> {
  static readonly Defaults: SpinSliderDefaults = {
    step: 1,
    min: 0,
    max: 100,
    value: 0
  };

  static override styles = [
    ...JollyField.styles,
    spinSliderStyles
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
    scrub: {
      target: () => this.#scrubTarget(),
      threshold: kDragThreshold,
      guide: false,
      pixelsPerStep: () => this.#track?.pixelsPerStep,
      jump: (event) => this.#jumpTo(event),
      onClick: () => this.#edit()
    }
  });

  constructor() {
    super();

    this.step = SpinSlider.Defaults.step;
    this.min = SpinSlider.Defaults.min;
    this.max = SpinSlider.Defaults.max;
    this.value = SpinSlider.Defaults.value;
  }

  protected override get scrubbable(): boolean {
    return this.editable && !this.mixed;
  }

  protected renderValue(): TemplateResult {
    const value = this.concreteValue;

    return html`
      <div class="wrap" style="--jolly-slider-progress:${this.#progress}">
        <input
          type="text"
          inputmode="decimal"
          role="spinbutton"
          .value=${this.#input.displayed}
          placeholder=${this.mixed ? MIXED_PLACEHOLDER : ""}
          ?disabled=${this.disabled}
          ?readonly=${this.inputReadonly}
          ?data-pointer-focus=${this.#input.pointerFocused}
          aria-label=${this.label === "" ? nothing : this.label}
          aria-valuemin=${this.min}
          aria-valuemax=${this.max}
          aria-valuenow=${value ?? nothing}
          aria-valuetext=${this.mixed ? "Mixed" : nothing}
          aria-readonly=${this.readonlyAria}
          aria-disabled=${this.lockedAria}
          aria-description=${this.lockDescription}
          aria-invalid=${this.displayError === null ? nothing : "true"}
          @input=${this.#input.onInput}
          @focus=${this.#input.onFocus}
          @keydown=${this.#input.onKeyDown}
          @blur=${this.#input.onBlur}
        >
        <div class="bar" aria-hidden="true"></div>
      </div>
    `;
  }

  get #progress(): number {
    const value = this.concreteValue;

    return value === undefined ?
      0 :
      unitRatio(value, this.min, this.max);
  }

  get #track(): Track | null {
    const bar = this.#bar;

    return bar === null ?
      null :
      new Track(bar.getBoundingClientRect(), {
        step: this.step,
        min: this.min,
        max: this.max
      });
  }

  get #field(): HTMLInputElement | null {
    return this.renderRoot.querySelector(".wrap input");
  }

  get #bar(): HTMLElement | null {
    return this.renderRoot.querySelector(".bar");
  }

  #scrubTarget(): HTMLElement | null {
    const field = this.#field;
    const editing = field !== null &&
      this.shadowRoot?.activeElement === field;

    return editing ?
      this.#bar :
      this.renderRoot.querySelector(".wrap");
  }

  #jumpTo(
    event: PointerEvent
  ): number | undefined {
    const bar = this.#bar;
    const pressed = bar !== null && event.composedPath().includes(bar);

    return pressed ?
      this.#track?.valueAt(event.clientX) :
      undefined;
  }

  #edit(): void {
    const field = this.#field;
    if (field === null) {
      return;
    }

    field.focus();
    field.select();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-spin-slider": SpinSlider;
  }
}
