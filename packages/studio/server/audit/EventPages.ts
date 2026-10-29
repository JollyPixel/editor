// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// CONSTANTS
const kBatchSize = 200;

export class EventPages implements AsyncIterable<EventStore.Event> {
  #store: EventStore.EventStore;
  #before: number | undefined;

  constructor(
    store: EventStore.EventStore,
    before: number | undefined
  ) {
    this.#store = store;
    this.#before = before;
  }

  async* [Symbol.asyncIterator](): AsyncIterableIterator<EventStore.Event> {
    let before = this.#before;
    for (;;) {
      const batch = await this.#store.reader.listAll({
        newestFirst: true,
        beforeEventId: before,
        limit: kBatchSize
      });
      yield* batch;
      if (batch.length < kBatchSize) {
        return;
      }
      before = batch[batch.length - 1].eventId;
    }
  }
}
