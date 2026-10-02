// Import Internal Dependencies
import "../monitors/Monitor.ts";
import "../monitors/Graph.ts";
import { FacadeItem } from "./FacadeItem.ts";
import {
  displayMonitorValue,
  type MonitorValue
} from "./monitorValue.ts";
import { isVec2Like } from "../math/guards.ts";
import { formatVector } from "../monitors/format.ts";

interface BindableMonitor extends HTMLElement {
  value: unknown;
  label: string;
}

interface VectorText {
  x: unknown;
  y: unknown;
  z: unknown;
  w: unknown;
  precision: number | undefined;
  text: string;
}

export type { MonitorValue } from "./monitorValue.ts";

export interface MonitorOptions<TValue = MonitorValue> {
  label?: string;
  format?: (value: TValue) => string;
  view?: "graph";
  min?: number;
  max?: number;
  rows?: number;
  /**
   * Decimals kept per axis when a vector value is formatted.
   * @default 2
   */
  precision?: number;
}

export type MonitorKey<TObject> = {
  [K in keyof TObject]: TObject[K] extends MonitorValue ? K : never;
}[keyof TObject];

/**
 * A read-only row bound to one object property: `jolly-monitor` by default,
 * `jolly-graph` when `options.view` is `"graph"`. A vector value is joined
 * into `x, y, z` unless `format` says otherwise.
 */
export class FacadeMonitor<
  TObject extends object,
  TKey extends MonitorKey<TObject>
> extends FacadeItem {
  readonly element: HTMLElement;

  #object: TObject;
  #key: TKey;
  #bindable: BindableMonitor;
  #options: MonitorOptions<TObject[TKey]>;
  #graph: boolean;
  #vectorText: VectorText | null = null;

  constructor(
    object: TObject,
    key: TKey,
    options: MonitorOptions<TObject[TKey]> = {}
  ) {
    super();
    this.#object = object;
    this.#key = key;
    this.#options = options;
    this.#graph = options.view === "graph";
    this.#bindable = createMonitorElement(options);
    this.#bindable.label = options.label ?? String(key);
    this.element = this.#bindable;
    this.refresh();
  }

  refresh(): void {
    const value = this.#object[this.#key];
    this.#bindable.value = this.#graph
      ? value
      : this.#display(value);
  }

  #display(
    value: TObject[TKey]
  ): unknown {
    const { format, precision } = this.#options;
    if (format !== undefined || !isVec2Like(value)) {
      return displayMonitorValue(value, this.#options);
    }

    const vector = value as unknown as Record<string, unknown>;
    const cached = this.#vectorText;
    if (
      cached !== null &&
      Object.is(cached.precision, precision) &&
      Object.is(cached.x, vector.x) &&
      Object.is(cached.y, vector.y) &&
      Object.is(cached.z, vector.z) &&
      Object.is(cached.w, vector.w)
    ) {
      return cached.text;
    }

    const text = formatVector(value, precision);
    this.#vectorText = {
      x: vector.x,
      y: vector.y,
      z: vector.z,
      w: vector.w,
      precision,
      text
    };

    return text;
  }
}

function createMonitorElement<TValue>(
  options: MonitorOptions<TValue>
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
    element.format = options.format as
      ((value: number) => string) | undefined;

    return element;
  }

  return document.createElement("jolly-monitor");
}
