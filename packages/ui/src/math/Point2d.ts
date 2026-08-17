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
import type { VectorValue } from "./types.ts";
import { vectorValueEquals, vectorValueHasChanged } from "./equals.ts";
import { point2dStyles } from "./Point2d.styles.ts";
import { ratioFromPointer } from "../color/area.ts";
import { formatNumber, quantize } from "../numeric/format.ts";
import { multiplierFor } from "../numeric/modifierMultiplier.ts";

export type Point2dAxis = "x" | "y";

export interface Point2dDefaults {
  step: number;
  min: number;
  max: number;
}

/**
 * Draggable 2D pad using a bounded Vector2 value.
 * A drag sets both axes, so it has no per-axis Mixed state.
 */
@customElement("jolly-point2d")
export class Point2d extends JollyField<VectorValue<Point2dAxis>> {
  static readonly Defaults: Point2dDefaults = {
    step: 0.01,
    min: 0,
    max: 1
  };

  static override styles = [
    ...JollyField.styles,
    point2dStyles
  ];

  @property({ attribute: false, hasChanged: vectorValueHasChanged })
  declare value: FieldValue<VectorValue<Point2dAxis>>;

  @property({ attribute: false, hasChanged: vectorValueHasChanged })
  declare default: VectorValue<Point2dAxis> | undefined;

  @property({ type: Number })
  declare step: number;

  @property({ type: Number })
  declare min: number;

  @property({ type: Number })
  declare max: number;

  constructor() {
    super();

    this.step = Point2d.Defaults.step;
    this.min = Point2d.Defaults.min;
    this.max = Point2d.Defaults.max;
    this.value = {
      x: (this.min + this.max) / 2,
      y: (this.min + this.max) / 2
    };
  }

  protected override valuesEqual(
    a: VectorValue<Point2dAxis>,
    b: VectorValue<Point2dAxis>
  ): boolean {
    return vectorValueEquals(a, b);
  }

  protected renderValue(): TemplateResult {
    const point = this.#point;
    const label = this.label === "" ? "Point" : this.label;

    return html`
      <div
        class="pad"
        role="slider"
        aria-label=${label}
        aria-valuetext=${
          point === undefined
            ? "Mixed"
            : `${formatNumber(point.x, this.step)}, ${formatNumber(point.y, this.step)}`
        }
        tabindex=${this.editable ? "0" : "-1"}
        style="--jolly-pad-x:${point ? this.#ratio(point.x) : 0.5}; --jolly-pad-y:${point ? this.#ratio(point.y) : 0.5}"
        ?data-mixed=${point === undefined}
        @pointerdown=${this.#onPointerDown}
        @keydown=${this.#onKeyDown}
      ><span class="handle" ?hidden=${point === undefined}></span></div>
    `;
  }

  get #point(): { x: number; y: number; } | undefined {
    if (isMixed(this.value)) {
      return undefined;
    }

    const { x, y } = this.value;

    return isMixed(x) || isMixed(y) ? undefined : { x, y };
  }

  #ratio(
    value: number
  ): number {
    const span = this.max - this.min;

    return span <= 0 ? 0.5 : Math.min(1, Math.max(0, (value - this.min) / span));
  }

  #onPointerDown = (
    event: PointerEvent
  ): void => {
    if (!this.editable || event.button !== 0) {
      return;
    }

    const pad = event.currentTarget as HTMLElement;

    event.preventDefault();
    pad.setPointerCapture(event.pointerId);
    pad.focus({ preventScroll: true });
    this.#applyPointer(pad, event, false);

    const onMove = (moved: PointerEvent): void => this.#applyPointer(pad, moved, false);
    const onUp = (released: PointerEvent): void => {
      pad.removeEventListener("pointermove", onMove);
      pad.removeEventListener("pointerup", onUp);
      pad.removeEventListener("pointercancel", onUp);
      this.#applyPointer(pad, released, true);
    };

    pad.addEventListener("pointermove", onMove);
    pad.addEventListener("pointerup", onUp);
    pad.addEventListener("pointercancel", onUp);
  };

  #applyPointer(
    pad: HTMLElement,
    event: PointerEvent,
    commit: boolean
  ): void {
    const ratio = ratioFromPointer(
      { x: event.clientX, y: event.clientY },
      pad.getBoundingClientRect()
    );
    const value = {
      x: quantize(this.min + (ratio.x * (this.max - this.min)), this.step, this.min, this.max),
      y: quantize(this.min + (ratio.y * (this.max - this.min)), this.step, this.min, this.max)
    };

    if (commit) {
      this.emitChange(value);
    }
    else {
      this.emitInput(value);
    }
  }

  #onKeyDown = (
    event: KeyboardEvent
  ): void => {
    const point = this.#point;
    if (!this.editable || point === undefined) {
      return;
    }

    const step = this.step * multiplierFor(event);
    let { x, y } = point;

    switch (event.key) {
      case "ArrowLeft":
        x -= step;
        break;
      case "ArrowRight":
        x += step;
        break;
      // Screen-space mapping: up is toward min y, matching the pointer drag.
      case "ArrowUp":
        y -= step;
        break;
      case "ArrowDown":
        y += step;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.emitChange({
      x: quantize(x, this.step, this.min, this.max),
      y: quantize(y, this.step, this.min, this.max)
    });
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "jolly-point2d": Point2d;
  }
}
