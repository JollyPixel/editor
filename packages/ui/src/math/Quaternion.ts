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
import {
  isMixed,
  type FieldValue
} from "../field/mixed.ts";
import type { QuatLike } from "./types.ts";
import {
  eulerRoundTrips,
  eulerToQuaternion,
  quaternionToEuler,
  type EulerAngles
} from "./euler.ts";
import {
  quatEquals,
  quatHasChanged
} from "./equals.ts";
import { vectorFieldStyles } from "./VectorField.styles.ts";
import { quaternionStyles } from "./Quaternion.styles.ts";
import { AxisController } from "./AxisController.ts";

export type QuaternionAxis = "x" | "y" | "z";

export interface QuaternionDefaults {
  /** Degrees per scrub step or arrow key press. */
  step: number;
}

// CONSTANTS
const kAxisKeys: readonly QuaternionAxis[] = ["x", "y", "z"];
const kRadToDeg = 180 / Math.PI;
const kDegToRad = Math.PI / 180;
const kIdentity: QuatLike = {
  x: 0,
  y: 0,
  z: 0,
  w: 1
};

/**
 * Edits a quaternion as XYZ Euler angles in degrees.
 * The Euler draft survives renders until value represents a new rotation.
 */
@customElement("jolly-quaternion")
export class Quaternion extends JollyField<QuatLike> {
  static readonly Defaults: QuaternionDefaults = {
    step: 1
  };

  static override styles = [
    ...JollyField.styles,
    vectorFieldStyles,
    quaternionStyles
  ];

  @property({
    attribute: false,
    hasChanged: quatHasChanged
  })
  declare value: FieldValue<QuatLike>;

  @property({
    attribute: false,
    hasChanged: quatHasChanged
  })
  declare default: QuatLike | undefined;

  @property({ type: Number })
  declare step: number;

  /** Overrides an axis's accessible name, e.g. `{ x: "pitch" }`. */
  @property({ attribute: false })
  declare axisLabels: Partial<Record<QuaternionAxis, string>>;

  #draft: EulerAngles | null = null;
  #axes = new Map<QuaternionAxis, AxisController>();

  constructor() {
    super();

    this.step = Quaternion.Defaults.step;
    this.axisLabels = {};
    this.value = kIdentity;
  }

  protected override get scrubbable(): boolean {
    return this.editable;
  }

  protected override valuesEqual(
    a: QuatLike,
    b: QuatLike
  ): boolean {
    return quatEquals(a, b);
  }

  protected renderValue(): TemplateResult {
    return html`
      <div class="axes">
        ${kAxisKeys.map((axis) => this.#controllerFor(axis).render())}
      </div>
    `;
  }

  #controllerFor(
    axis: QuaternionAxis
  ): AxisController {
    let controller = this.#axes.get(axis);
    if (controller === undefined) {
      controller = new AxisController(this, {
        key: axis,
        label: axis.toUpperCase(),
        ariaLabel: () => this.axisLabels[axis] ?? axis.toUpperCase(),
        colorVar: `--jolly-axis-${axis}`,
        step: () => this.step,
        min: () => Number.NEGATIVE_INFINITY,
        max: () => Number.POSITIVE_INFINITY,
        editable: () => this.editable,
        disabled: () => this.disabled,
        value: () => this.#axisDegrees(axis),
        onInput: (value) => this.#commitAxis(axis, value, true),
        onChange: (value) => this.#commitAxis(axis, value, false)
      });
      this.#axes.set(axis, controller);
    }

    return controller;
  }

  #axisDegrees(
    axis: QuaternionAxis
  ): number | undefined {
    if (isMixed(this.value)) {
      return undefined;
    }

    return this.#resolvedDraft(this.value)[axis] * kRadToDeg;
  }

  #commitAxis(
    axis: QuaternionAxis,
    valueDegrees: number,
    live: boolean
  ): void {
    if (isMixed(this.value)) {
      return;
    }

    const draft: EulerAngles = {
      ...this.#resolvedDraft(this.value),
      [axis]: valueDegrees * kDegToRad
    };
    this.#draft = draft;

    const quaternion = eulerToQuaternion(draft);
    if (live) {
      this.emitInput(quaternion);
    }
    else {
      this.emitChange(quaternion);
    }
  }

  /** Reuses the Euler draft while it still represents target. */
  #resolvedDraft(
    target: QuatLike
  ): EulerAngles {
    if (
      this.#draft !== null &&
      eulerRoundTrips(this.#draft, target)
    ) {
      return this.#draft;
    }

    const derived = quaternionToEuler(target);
    this.#draft = derived;

    return derived;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-quaternion": Quaternion;
  }
}
