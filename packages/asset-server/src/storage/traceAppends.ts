// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import type { Logger } from "../common/logger.ts";

export function traceAppends(
  eventStore: EventStore.EventStore,
  logger: Logger
): () => void {
  const unsubscribeAppend = eventStore.subscribe((event) => {
    if (!logger.isLevelEnabled("debug")) {
      return;
    }

    logger
      .withMetadata({
        assetType: event.assetType,
        assetId: event.assetId,
        eventType: event.eventType,
        eventVersion: event.eventVersion
      })
      .debug("append event");
  });
  const unsubscribeRejection = eventStore.subscribeRejections(
    (error, input) => {
      if (input.expectedVersion !== undefined) {
        return;
      }

      logger
        .withMetadata({
          assetType: input.assetType,
          assetId: input.assetId,
          eventType: input.eventType,
          reason: error.message,
          outcome: "failed"
        })
        .error("append event");
    }
  );

  return () => {
    unsubscribeAppend();
    unsubscribeRejection();
  };
}
