// Import Third-party Dependencies
import {
  Emitter
} from "@openally/emitt";
import {
  wrap
} from "@openally/result";

// Import Internal Dependencies
import type {
  AppendInput,
  Event,
  EventDataMap,
  EventListener,
  EventReader,
  SubscribeOptions,
  TypedEventStore
} from "../EventStore.ts";
import type {
  EventLog
} from "./EventLog.ts";

type AppendNotifications = {
  append: (
    event: Event
  ) => void;
  rejection: (
    error: Error,
    input: AppendInput
  ) => void;
};

export function createEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  log: EventLog
): TypedEventStore<TMap> {
  const notifications = new Emitter<AppendNotifications>();
  const reader: EventReader = {
    list: (assetId, fromVersion) => log.list(assetId, fromVersion),
    listAll: (options) => log.listAll(options),
    listFromCheckpoints: (options) => log.listFromCheckpoints(options)
  };

  return {
    writer: {
      append: (input) => wrap<Event, Error>(
        () => log.insert(input)
      )
        .andTee((event) => notifications.emit("append", event))
        .orTee((error) => notifications.emit("rejection", error, input))
    },
    reader,
    subscribe: (
      listener: EventListener,
      options: SubscribeOptions = {}
    ) => {
      const { eventTypePrefix } = options;
      const handler: EventListener = eventTypePrefix === undefined ?
        listener :
        (event) => {
          if (event.eventType.startsWith(eventTypePrefix)) {
            listener(event);
          }
        };

      return notifications.subscribe("append", handler);
    },
    subscribeRejections: (listener) => notifications.subscribe(
      "rejection",
      listener
    ),
    compact: (options) => log.compact(options),
    close: () => log.close(),
    [Symbol.dispose]: () => log.close()
  };
}
