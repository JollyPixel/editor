// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  wrap,
  type Result
} from "@openally/result";

// Import Internal Dependencies
import type {
  AppendInput,
  EventWriter,
  EventStoreEventMap,
  Event
} from "../../EventStore.ts";
import type { MemoryEventLog } from "./log.ts";

export class MemoryEventWriter extends Emitter<
  EventStoreEventMap
> implements EventWriter {
  #log: MemoryEventLog;

  constructor(
    log: MemoryEventLog
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
