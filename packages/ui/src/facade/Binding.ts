// Import Internal Dependencies
import {
  dispatchTag,
  toJollyOptions,
  type DispatchOptions,
  type DispatchTag
} from "./dispatch.ts";
import { detailOf } from "../dom.ts";
import type {
  JollyChangeDetail
} from "../field/events.ts";
import type { FieldAlign } from "../field/JollyField.ts";

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

/**
 * A dispatched control bound to one object property. Reads pick the tag;
 * writes go straight back to the object, mirroring `folder.addBinding`.
 */
export class Binding<TObject extends object, TKey extends keyof TObject> {
  readonly element: HTMLElement;

  #object: TObject;
  #key: TKey;
  #bindable: BindableElement;
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
    this.#bindable = buildElement(tag, options);
    this.#bindable.label = options.label ?? String(key);
    // A checkbox reads better parked at the trailing edge, the way the rest
    // of a row's controls naturally fill it; every other control keeps the
    // leading default.
    this.#bindable.align = options.align ?? (tag === "jolly-checkbox" ? "end" : "start");
    this.#bindable.path = options.path ?? null;
    this.#bindable.value = value;
    this.element = this.#bindable;

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

  /** Re-reads the bound property, for a value changed outside the control. */
  refresh(): void {
    this.#bindable.value = this.#object[this.#key];
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

    this.#object[this.#key] = detail.value;
    // The write-back a controlled element needs: without re-assigning its
    // `value`, the next render shows the property this replaced instead of
    // what was just typed or dragged.
    this.#bindable.value = detail.value;
    for (const handler of this.#handlers) {
      handler({
        value: detail.value,
        last
      });
    }
  }
}

function buildElement<TValue>(
  tag: DispatchTag,
  options: BindingOptions<TValue>
): BindableElement {
  switch (tag) {
    case "jolly-number":
    case "jolly-slider":
    case "jolly-range": {
      const element = document.createElement(tag);
      if (options.min !== undefined) {
        element.min = options.min;
      }
      if (options.max !== undefined) {
        element.max = options.max;
      }
      if (options.step !== undefined) {
        element.step = options.step;
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
    case "jolly-checkbox":
    case "jolly-color":
    case "jolly-text":
      return document.createElement(tag);
    default:
      return tag;
  }
}
