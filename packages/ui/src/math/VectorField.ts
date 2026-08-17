// Import Third-party Dependencies
import {
  html,
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

export interface VectorFieldDefaults {
  step: number;
  min: number;
  max: number;
}

/**
 * Shared base for `Vector2`, `Vector3` and `Vector4`.
 */
export abstract class VectorField<TAxis extends string>
  extends JollyField<VectorValue<TAxis>> {
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
  declare value: FieldValue<VectorValue<TAxis>>;

  @property({
    attribute: false,
    hasChanged: vectorValueHasChanged
  })
  declare default: VectorValue<TAxis> | undefined;

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

  constructor() {
    super();

    this.step = VectorField.Defaults.step;
    this.min = VectorField.Defaults.min;
    this.max = VectorField.Defaults.max;
    this.axisLabels = {};
    this.value = Object.fromEntries(
      this.getAxisKeys().map((axis) => [axis, 0])
    ) as VectorValue<TAxis>;
  }

  protected abstract getAxisKeys(): readonly TAxis[];

  protected override get scrubbable(): boolean {
    return this.editable;
  }

  protected override valuesEqual(
    a: VectorValue<TAxis>,
    b: VectorValue<TAxis>
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
    if (isMixed(this.value)) {
      return undefined;
    }

    const axisValue = this.value[axis];

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
  ): VectorValue<TAxis> {
    const current = this.value;
    const base: Record<TAxis, FieldValue<number>> = isMixed(current)
      ? Object.fromEntries(
        this.getAxisKeys().map((key) => [key, current])
      ) as Record<TAxis, FieldValue<number>>
      : { ...current as Record<TAxis, FieldValue<number>> };

    return {
      ...base,
      [axis]: value
    };
  }
}
