// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_UPDATED,
  decodeContent,
  isAssetEvent,
  type AssetKindHandler,
  type SnapshotPolicy
} from "#src/index.ts";
import {
  bytes,
  text
} from "./bytes.ts";

export const COUNTER_INCREMENTED = "counter.incremented";

export interface CounterState {
  value: number;
}

/**
 * Minimal domain kind: one counter folded from `counter.incremented`
 * events, serialized as its decimal value.
 */
export function counterHandler(
  snapshot?: SnapshotPolicy
): AssetKindHandler<CounterState> {
  return {
    kind: "counter",
    match: ["**/*.counter"],
    snapshot,

    create(): CounterState {
      return { value: 0 };
    },

    apply(
      state: CounterState,
      event: EventStore.Event
    ): void {
      if (
        isAssetEvent(event) && (
          event.eventType === ASSET_CREATED ||
          event.eventType === ASSET_UPDATED
        )
      ) {
        state.value = Number.parseInt(
          text(decodeContent(event.eventData.content)),
          10
        );
      }
      else if (event.eventType === COUNTER_INCREMENTED) {
        state.value += 1;
      }
    },

    serialize(
      state: CounterState
    ): Promise<Uint8Array> {
      return Promise.resolve(bytes(String(state.value)));
    }
  };
}
