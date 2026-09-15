// Import Internal Dependencies
import type {
  AssetCommands,
  AssetKindHandler,
  SnapshotPolicy
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

const kCounterCommands: AssetCommands<CounterState, CounterCommand> = {
  eventType: COUNTER_INCREMENTED,
  parse: (payload) => (isCounterCommand(payload) ? payload : null),
  apply: (state) => {
    state.value += 1;
  }
};

export function counterHandler(
  snapshot?: SnapshotPolicy
): AssetKindHandler<CounterState, CounterCommand> {
  return {
    kind: "counter",
    match: ["**/*.counter"],
    snapshot,
    commands: kCounterCommands,

    create(): CounterState {
      return { value: 0 };
    },

    load(
      state: CounterState,
      content: Uint8Array
    ): void {
      state.value = Number.parseInt(text(content), 10);
    },

    clear: () => void 0,

    serialize(
      state: CounterState
    ): Promise<Uint8Array> {
      return Promise.resolve(bytes(String(state.value)));
    }
  };
}

export function liveCounterHandler(
  snapshot?: SnapshotPolicy
): AssetKindHandler<CounterState, CounterCommand> {
  return {
    ...counterHandler(snapshot),
    commands: {
      ...kCounterCommands,
      live: (binding) => {
        return {
          protocols: counterCommandProtocols,
          snapshot: () => {
            return { value: binding.state.value };
          },
          arbitrate: (command) => {
            return { command };
          }
        };
      }
    }
  };
}
