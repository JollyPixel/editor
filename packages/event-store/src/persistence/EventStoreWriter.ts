// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  wrap,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  AppendInput,
  Event,
  EventStoreEventMap,
  EventWriter
} from "../EventStore.ts";
import type { EventLog } from "./EventLog.ts";

export class EventStoreWriter extends Emitter<
  EventStoreEventMap
> implements EventWriter {
  #log: EventLog;

  constructor(
    log: EventLog
  ) {
    super();
    this.#log = log;
  }

  append(
    input: AppendInput
  ): Result<Event, Error> {
    return wrap<Event, Error>(
      () => this.#log.insert(input)
    )
      .andTee((event) => this.emit("append", event))
      .orTee((error) => this.emit("error", error, input));
  }
}
