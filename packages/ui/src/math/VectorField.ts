// Import Third-party Dependencies
import {
  html,
  type PropertyValues,
  type TemplateResult
} from "lit";
import { property } from "lit/decorators.js";

// Import Internal Dependencies
import { JollyField } from "../field/JollyField.ts";
import {
  isMixed,
  type FieldValue
} from "../field/mixed.ts";
import type { VectorValue } from "./types.ts";
import { vectorFieldStyles } from "./VectorField.styles.ts";
import {
  vectorValueEquals,
  vectorValueHasChanged
} from "./equals.ts";
import { AxisController } from "./AxisController.ts";
import {
  rekeyVectorValue,
  sameAxisKeys
} from "./axes.ts";

export interface VectorFieldDefaults {
  step: number;
  min: number;
  max: number;
}

/**
 * Shared base for `Vector2`, `Vector3` and `Vector4`.
 */
export abstract class VectorField<
  TAxis extends string,
  TValue extends VectorValue<string> = VectorValue<TAxis>
> extends JollyField<TValue> {
  static readonly Defaults: VectorFieldDefaults = {
    step: 0.1,
    min: Number.NEGATIVE_INFINITY,
    max: Number.POSITIVE_INFINITY
  };

  static override styles = [
    ...JollyField.styles,
    vectorFieldStyles
  ];

  @property({
    attribute: false,
    hasChanged: vectorValueHasChanged
  })
  declare value: FieldValue<TValue>;

  @property({
    attribute: false,
    hasChanged: vectorValueHasChanged
  })
  declare default: TValue | undefined;

  @property({ type: Number })
  declare step: number;

  @property({ type: Number })
  declare min: number;

  @property({ type: Number })
  declare max: number;

  /**
   * Overrides an axis's accessible name for domain terms, e.g. `{ x: "pitch" }`.
   */
  @property({ attribute: false })
  declare axisLabels: Partial<Record<TAxis, string>>;

  #axes = new Map<TAxis, AxisController>();
  #axisKeys: readonly TAxis[] | null = null;

  constructor() {
    super();

    this.step = VectorField.Defaults.step;
    this.min = VectorField.Defaults.min;
    this.max = VectorField.Defaults.max;
    this.axisLabels = {};
    this.value = Object.fromEntries(
      this.getAxisKeys().map((axis) => [axis, 0])
    ) as TValue;
  }

  protected abstract getAxisKeys(): readonly TAxis[];

  protected override get scrubbable(): boolean {
    return this.editable;
  }

  protected override willUpdate(
    changed: PropertyValues<this>
  ): void {
    this.#syncAxisKeys();
    super.willUpdate(changed);
  }

  protected override valuesEqual(
    a: TValue,
    b: TValue
  ): boolean {
    return vectorValueEquals(a, b);
  }

  protected renderValue(): TemplateResult {
    return html`
      <div class="axes">
        ${this.getAxisKeys().map((axis) => this.#controllerFor(axis).render())}
      </div>
    `;
  }

  #syncAxisKeys(): void {
    const next = this.getAxisKeys();
    const previous = this.#axisKeys;
    if (previous !== null && sameAxisKeys(previous, next)) {
      return;
    }

    this.#axisKeys = next;
    this.#axes.clear();

    const rekeyed = rekeyVectorValue(this.value, previous, next);
    if (rekeyed !== null) {
      this.value = rekeyed;
    }
  }

  #controllerFor(
    axis: TAxis
  ): AxisController {
    let controller = this.#axes.get(axis);
    if (controller === undefined) {
      controller = new AxisController(this, {
        key: axis,
        label: axis.toUpperCase(),
        ariaLabel: () => this.axisLabels[axis] ?? axis.toUpperCase(),
        colorVar: `--jolly-axis-${axis}`,
        step: () => this.step,
        min: () => this.min,
        max: () => this.max,
        editable: () => this.editable,
        disabled: () => this.disabled,
        value: () => this.#axisValue(axis),
        onInput: (value) => this.#commitAxis(axis, value, true),
        onChange: (value) => this.#commitAxis(axis, value, false)
      });
      this.#axes.set(axis, controller);
    }

    return controller;
  }

  #axisValue(
    axis: TAxis
  ): number | undefined {
    const current = this.value;
    if (isMixed(current)) {
      return undefined;
    }

    const axisValue = (current as Record<TAxis, FieldValue<number>>)[axis];

    return isMixed(axisValue) ? undefined : axisValue;
  }

  #commitAxis(
    axis: TAxis,
    value: number,
    live: boolean
  ): void {
    const next = this.#withAxis(axis, value);
    if (live) {
      this.emitInput(next);
    }
    else {
      this.emitChange(next);
    }
  }

  #withAxis(
    axis: TAxis,
    value: number
  ): TValue {
    const current = this.value;
    const base: Record<TAxis, FieldValue<number>> = isMixed(current)
      ? Object.fromEntries(
        this.getAxisKeys().map((key) => [key, current])
      ) as Record<TAxis, FieldValue<number>>
      : { ...current as Record<TAxis, FieldValue<number>> };

    return {
      ...base,
      [axis]: value
    } as TValue;
  }
}
