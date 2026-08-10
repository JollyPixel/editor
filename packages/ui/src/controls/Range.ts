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
import { JollyField } from "../field/JollyField.ts";
import { MIXED_PLACEHOLDER } from "../field/mixed.ts";
import {
  formatNumber,
  quantize
} from "../numeric/format.ts";
import { rangeStyles } from "./Range.styles.ts";
import { multiplierFor } from "../numeric/modifierMultiplier.ts";
import { valueFromDelta } from "../numeric/valueFromDelta.ts";
import { isInputElement } from "../dom.ts";
import { PointerFocusController } from "../interaction/PointerFocusController.ts";
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

  #pointerFocus = new PointerFocusController(this);

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

  protected renderValue(): TemplateResult {
    const interval = this.concreteValue;

    return html`
      ${this.#renderEnd("from", interval?.from)}
      <span class="separator">to</span>
      ${this.#renderEnd("to", interval?.to)}
    `;
  }

  #renderEnd(
    end: keyof Interval,
    value: number | undefined
  ): TemplateResult {
    return html`
      <input
        type="text"
        inputmode="decimal"
        class="end"
        data-end=${end}
        .value=${value === undefined ? "" : formatNumber(value, this.step)}
        placeholder=${this.mixed ? MIXED_PLACEHOLDER : ""}
        aria-label=${end === "from" ? "Range start" : "Range end"}
        ?disabled=${this.disabled}
        ?readonly=${this.inputReadonly}
        ?data-pointer-focus=${this.#pointerFocus.active}
        aria-readonly=${this.readonlyAria}
        aria-disabled=${this.lockedAria}
        aria-description=${this.lockDescription}
        @change=${(event: Event) => this.#onCommit(end, event)}
        @focus=${this.#pointerFocus.onFocus}
        @blur=${this.#pointerFocus.onBlur}
        @keydown=${(event: KeyboardEvent) => this.#onKeyDown(end, event)}
      >
    `;
  }

  /**
   * Commits one modifier-scaled step from the current endpoint.
   */
  #onKeyDown(
    end: keyof Interval,
    event: KeyboardEvent
  ): void {
    this.#pointerFocus.onKeyDown();

    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") {
      return;
    }

    const interval = this.editable ? this.concreteValue : undefined;
    if (interval === undefined) {
      return;
    }

    // Prevent the input caret from moving.
    event.preventDefault();

    const direction = event.key === "ArrowUp" ? 1 : -1;
    // Scale the step, not the count, so Alt can produce fractional steps.
    const effectiveStep = this.step * multiplierFor(event);

    const stepped = valueFromDelta({
      start: interval[end],
      deltaPx: direction,
      step: effectiveStep,
      pixelsPerStep: 1,
      min: this.min,
      max: this.max
    });

    this.emitChange(
      this.#clampToOther(interval, end, stepped)
    );
  }

  #onCommit(
    end: keyof Interval,
    event: Event
  ): void {
    const interval = this.concreteValue;
    if (
      !isInputElement(event.target) ||
      interval === undefined ||
      !this.editable
    ) {
      return;
    }

    const parsed = Number(
      event.target.value.trim().replace(",", ".")
    );
    if (!Number.isFinite(parsed)) {
      this.requestUpdate();

      return;
    }

    this.emitChange(
      this.#withEnd(interval, end, parsed)
    );
  }

  #withEnd(
    interval: Interval,
    end: keyof Interval,
    raw: number
  ): Interval {
    const value = quantize(
      raw,
      this.step,
      this.min,
      this.max
    );

    return this.#clampToOther(interval, end, value);
  }

  #clampToOther(
    interval: Interval,
    end: keyof Interval,
    value: number
  ): Interval {
    if (end === "from") {
      return {
        from: Math.min(value, interval.to),
        to: interval.to
      };
    }

    return {
      from: interval.from,
      to: Math.max(value, interval.from)
    };
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-range": Range;
  }
}
