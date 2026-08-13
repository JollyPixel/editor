// Import Internal Dependencies
import "../monitors/Monitor.ts";
import "../monitors/Graph.ts";

interface BindableMonitor extends HTMLElement {
  value: unknown;
  label: string;
}

export interface MonitorOptions {
  label?: string;
  format?: (value: number) => string;
  view?: "graph";
  min?: number;
  max?: number;
  rows?: number;
}

/**
 * Keys of `TObject` whose value is a number or a string, the two shapes
 * `jolly-monitor` and `jolly-graph` can display.
 */
export type MonitorKey<TObject> = {
  [K in keyof TObject]: TObject[K] extends number | string ? K : never;
}[keyof TObject];

/**
 * A read-only row bound to one object property: `jolly-monitor` by default,
 * `jolly-graph` when `options.view` is `"graph"`.
 */
export class Monitor<
  TObject extends object,
  TKey extends MonitorKey<TObject>
> {
  readonly element: HTMLElement;

  #object: TObject;
  #key: TKey;
  #bindable: BindableMonitor;

  constructor(
    object: TObject,
    key: TKey,
    options: MonitorOptions = {}
  ) {
    this.#object = object;
    this.#key = key;
    this.#bindable = createMonitorElement(options);
    this.#bindable.label = options.label ?? String(key);
    this.element = this.#bindable;
    this.refresh();
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
    return this.element.hasAttribute("disabled");
  }

  set disabled(
    value: boolean
  ) {
    this.element.toggleAttribute("disabled", value);
  }

  /** Re-reads the bound property, for a value refreshed on the application's own cadence. */
  refresh(): void {
    this.#bindable.value = this.#object[this.#key];
  }

  dispose(): void {
    this.element.remove();
  }
}

function createMonitorElement(
  options: MonitorOptions
): BindableMonitor {
  if (options.view === "graph") {
    const element = document.createElement("jolly-graph");
    if (options.min !== undefined) {
      element.min = options.min;
    }
    if (options.max !== undefined) {
      element.max = options.max;
    }
    if (options.rows !== undefined) {
      element.rows = options.rows;
    }
    element.format = options.format;

    return element;
  }

  const element = document.createElement("jolly-monitor");
  element.format = options.format;

  return element;
}
