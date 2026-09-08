// Import Internal Dependencies
import type {
  CompactOptions,
  EventDataMap,
  EventListener,
  SubscribeOptions,
  TypedEventStore
} from "../EventStore.ts";
import type {
  EventLog
} from "./EventLog.ts";
import {
  EventStoreWriter
} from "./EventStoreWriter.ts";

export function createEventStore<
  TMap extends EventDataMap = EventDataMap
>(
  log: EventLog
): TypedEventStore<TMap> {
  const writer = new EventStoreWriter(log);

  return {
    writer: writer as unknown as TypedEventStore<TMap>["writer"],
    reader: log,
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

      writer.on("append", handler);

      return () => writer.off("append", handler);
    },
    compact: (
      options: CompactOptions
    ) => log.compact(options),
    close: () => log.close(),
    [Symbol.dispose]: () => log.close()
  };
}
