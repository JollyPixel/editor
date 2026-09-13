// Import Third-party Dependencies
import {
  html,
  type TemplateResult
} from "lit";
import {
  customElement,
  property
} from "lit/decorators.js";

// Import Internal Dependencies
import { DraftController } from "../field/DraftController.ts";
import { JollyField } from "../field/JollyField.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import { NumericInputController } from "../field/NumericInputController.ts";
import { rangeStyles } from "./Range.styles.ts";
import type { Interval } from "./types.ts";

export interface RangeDefaults {
  step: number;
  min: number;
  max: number;
  from: number;
  to: number;
}

/**
 * Edits a bounded interval whose endpoints cannot cross.
 */
@customElement("jolly-range")
export class Range extends JollyField<Interval> {
  static readonly Defaults: RangeDefaults = {
    step: 1,
    min: 0,
    max: 100,
    from: 0,
    to: 100
  };

  static override styles = [
    ...JollyField.styles,
    rangeStyles
  ];

  @property({ type: Number })
  declare step: number;

  @property({ type: Number })
  declare min: number;

  @property({ type: Number })
  declare max: number;

  #ends: Record<keyof Interval, NumericInputController> = {
    from: this.#endController("from"),
    to: this.#endController("to")
  };

  constructor() {
    super();

    this.step = Range.Defaults.step;
    this.min = Range.Defaults.min;
    this.max = Range.Defaults.max;
    this.value = {
      from: Range.Defaults.from,
      to: Range.Defaults.to
    };
  }

  protected override valuesEqual(
    a: Interval,
    b: Interval
  ): boolean {
    return a.from === b.from && a.to === b.to;
  }

  protected override get displayError(): string | null {
    return this.#ends.from.error ??
      this.#ends.to.error ??
      super.displayError;
  }

  protected renderValue(): TemplateResult {
    return html`
      ${this.#renderEnd("from")}
      <span class="separator" aria-hidden="true"></span>
      ${this.#renderEnd("to")}
    `;
  }

  #renderEnd(
    end: keyof Interval
  ): TemplateResult {
    const input = this.#ends[end];

    return html`
      <input
        type="text"
        inputmode="decimal"
        class="end"
        data-end=${end}
        .value=${input.displayed}
        placeholder=${this.mixed ? MIXED_PLACEHOLDER : ""}
        aria-label=${end === "from" ? "Range start" : "Range end"}
        ?disabled=${this.disabled}
        ?readonly=${this.inputReadonly}
        ?data-pointer-focus=${input.pointerFocused}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-description=${this.lockDescription}
        @input=${input.onInput}
        @focus=${input.onFocus}
        @blur=${input.onBlur}
        @keydown=${input.onKeyDown}
      >
    `;
  }

  #endController(
    end: keyof Interval
  ): NumericInputController {
    return new NumericInputController(this, {
      draft: new DraftController<number>(this),
      step: () => this.step,
      min: () => this.min,
      max: () => this.max,
      value: () => this.concreteValue?.[end],
      editable: () => this.editable && this.concreteValue !== undefined,
      coerce: (value) => this.#clampToOther(end, value),
      onInput: (value) => this.#emitEnd(end, value, true),
      onChange: (value) => this.#emitEnd(end, value, false)
    });
  }

  #clampToOther(
    end: keyof Interval,
    value: number
  ): number {
    const interval = this.concreteValue;
    if (interval === undefined) {
      return value;
    }

    return end === "from" ?
      Math.min(value, interval.to) :
      Math.max(value, interval.from);
  }

  #emitEnd(
    end: keyof Interval,
    value: number,
    live: boolean
  ): void {
    const interval = this.concreteValue;
    if (interval === undefined) {
      return;
    }

    const next = {
      ...interval,
      [end]: value
    };
    if (live) {
      this.emitInput(next);
    }
    else {
      this.emitChange(next);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-range": Range;
  }
}
