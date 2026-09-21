// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

// Import Internal Dependencies
import { detailOf } from "../dom.ts";
import type { JollyChangeDetail } from "./events.ts";

export interface FieldSource<TValue> {
  read(): TValue;
  write(
    value: TValue,
    last: boolean
  ): void;
}

export class FieldBinding<TValue> {
  #host: ReactiveControllerHost;
  #source: FieldSource<TValue>;

  constructor(
    host: ReactiveControllerHost,
    source: FieldSource<TValue>
  ) {
    this.#host = host;
    this.#source = source;
  }

  get value(): TValue {
    return this.#source.read();
  }

  input = (
    event: Event
  ): void => {
    this.#apply(event, false);
  };

  commit = (
    event: Event
  ): void => {
    this.#apply(event, true);
  };

  #apply(
    event: Event,
    last: boolean
  ): void {
    const detail = detailOf<unknown>(event);
    if (!carriesValue<TValue>(detail)) {
      return;
    }

    this.#source.write(detail.value, last);
    this.#host.requestUpdate();
  }
}

function carriesValue<TValue>(
  detail: unknown
): detail is JollyChangeDetail<TValue> {
  return typeof detail === "object" &&
    detail !== null &&
    "value" in detail;
}
