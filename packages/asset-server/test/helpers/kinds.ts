// Import Third-party Dependencies
import type * as EventStore from "@jolly-pixel/event-store";

// Import Internal Dependencies
import {
  ASSET_CREATED,
  ASSET_UPDATED,
  decodeContent,
  parseAssetEvent,
  type AssetKindHandler,
  type SnapshotPolicy
} from "#src/index.ts";
import {
  bytes,
  text
} from "./bytes.ts";
import { counterCommandProtocols } from "./protocols.ts";

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
      const parsed = parseAssetEvent(event);
      if (
        parsed.ok && (
          parsed.val.eventType === ASSET_CREATED ||
          parsed.val.eventType === ASSET_UPDATED
        )
      ) {
        state.value = Number.parseInt(
          text(decodeContent(parsed.val.eventData.content)),
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

export interface CounterCommand {
  action: "increment";
}

export function isCounterCommand(
  payload: unknown
): payload is CounterCommand {
  return typeof payload === "object" &&
    payload !== null &&
    "action" in payload &&
    payload.action === "increment";
}

export function liveCounterHandler(
  snapshot?: SnapshotPolicy
): AssetKindHandler<CounterState, CounterCommand> {
  return {
    ...counterHandler(snapshot),
    live: (binding) => {
      return {
        commandEventType: COUNTER_INCREMENTED,
        protocols: counterCommandProtocols,
        parse: (payload) => (isCounterCommand(payload) ? payload : null),
        snapshot: () => {
          return { value: binding.state.value };
        },
        arbitrate: (command) => {
          return { command };
        }
      };
    }
  };
}
