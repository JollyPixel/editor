// Import Internal Dependencies
import {
  dispatchTag,
  isMathTag,
  toJollyOptions,
  type DispatchOptions,
  type DispatchTag
} from "./dispatch.ts";
import { detailOf } from "../dom.ts";
import type {
  JollyChangeDetail
} from "../field/events.ts";
import type { FieldAlign } from "../field/JollyField.ts";
import {
  copyComponents,
  snapshotComponents
} from "../math/components.ts";
import { vec2PairOf } from "../math/guards.ts";

// CONSTANTS
const kEightDigitHex = /^#[0-9a-f]{8}$/i;

/**
 * Structural surface every dispatched control shares through `JollyField`.
 */
interface BindableElement extends HTMLElement {
  value: unknown;
  label: string;
  disabled: boolean;
  align: FieldAlign;
  path: string | null;
}

export interface BindingOptions<TValue> extends DispatchOptions<TValue> {
  label?: string;
  align?: FieldAlign;
  path?: string;
}

export interface BindingChangeEvent<TValue> {
  value: TValue;
  last: boolean;
}

export type BindingChangeHandler<TValue> = (
  event: BindingChangeEvent<TValue>
) => void;

export class Binding<
  TObject extends object,
  TKey extends keyof TObject
> {
  readonly element: HTMLElement;

  #object: TObject;
  #key: TKey;
  #bindable: BindableElement;
  #math: boolean;
  #handlers: BindingChangeHandler<TObject[TKey]>[] = [];

  constructor(
    object: TObject,
    key: TKey,
    options: BindingOptions<TObject[TKey]> = {}
  ) {
    this.#object = object;
    this.#key = key;

    const value = object[key];
    const tag = dispatchTag(value, options);
    this.#math = isMathTag(tag);
    this.#bindable = buildElement(tag, value, options);
    this.#bindable.label = options.label ?? String(key);
    this.#bindable.align = options.align ?? (tag === "jolly-checkbox" ? "end" : "start");
    this.#bindable.path = options.path ?? null;
    this.element = this.#bindable;
    this.refresh();

    this.#bindable.addEventListener(
      "jolly-input",
      (event) => this.#onFieldEvent(event, false)
    );
    this.#bindable.addEventListener(
      "jolly-change",
      (event) => this.#onFieldEvent(event, true)
    );
  }

  get hidden(): boolean {
    return Boolean(this.element.hidden);
  }

  set hidden(
    value: boolean
  ) {
    this.element.hidden = value;
  }

  get disabled(): boolean {
    return this.#bindable.disabled;
  }

  set disabled(
    value: boolean
  ) {
    this.#bindable.disabled = value;
  }

  on(
    _name: "change",
    handler: BindingChangeHandler<TObject[TKey]>
  ): this {
    this.#handlers.push(handler);

    return this;
  }

  refresh(): void {
    const value = this.#object[this.#key];
    this.#bindable.value = this.#math
      ? snapshotComponents(value)
      : value;
  }

  dispose(): void {
    this.element.remove();
  }

  #onFieldEvent(
    event: Event,
    last: boolean
  ): void {
    const detail = detailOf<JollyChangeDetail<TObject[TKey]>>(
      event
    );
    if (detail === null) {
      return;
    }

    if (this.#math) {
      copyComponents(this.#object[this.#key], detail.value);
    }
    else {
      this.#object[this.#key] = detail.value;
    }
    this.#bindable.value = detail.value;

    const value = this.#object[this.#key];
    for (const handler of this.#handlers) {
      handler({
        value,
        last
      });
    }
  }
}

function buildElement<TValue>(
  tag: DispatchTag,
  value: TValue,
  options: BindingOptions<TValue>
): BindableElement {
  switch (tag) {
    case "jolly-number":
    case "jolly-slider":
    case "jolly-range":
    case "jolly-point2d": {
      const element = document.createElement(tag);
      applyBounds(element, options);

      return element;
    }
    case "jolly-vector2": {
      const element = document.createElement(tag);
      applyBounds(element, options);
      element.axes = options.axes ?? vec2PairOf(value) ?? "xy";
      if (options.axisLabels !== undefined) {
        element.axisLabels = options.axisLabels;
      }

      return element;
    }
    case "jolly-vector3":
    case "jolly-vector4": {
      const element = document.createElement(tag);
      applyBounds(element, options);
      if (options.axisLabels !== undefined) {
        element.axisLabels = options.axisLabels;
      }

      return element;
    }
    case "jolly-quaternion": {
      const element = document.createElement(tag);
      if (options.step !== undefined) {
        element.step = options.step;
      }
      if (options.axisLabels !== undefined) {
        element.axisLabels = options.axisLabels;
      }

      return element;
    }
    case "jolly-select": {
      const element = document.createElement(tag);
      if (options.options !== undefined) {
        element.options = toJollyOptions(
          options.options
        );
      }

      return element;
    }
    case "jolly-color": {
      const element = document.createElement(tag);
      element.alpha = options.alpha ??
        (typeof value === "string" && kEightDigitHex.test(value));

      return element;
    }
    case "jolly-checkbox":
    case "jolly-text":
      return document.createElement(tag);
    default:
      return tag;
  }
}

function applyBounds<TValue>(
  element: {
    min: number;
    max: number;
    step: number;
  },
  options: BindingOptions<TValue>
): void {
  if (options.min !== undefined) {
    element.min = options.min;
  }
  if (options.max !== undefined) {
    element.max = options.max;
  }
  if (options.step !== undefined) {
    element.step = options.step;
  }
}
