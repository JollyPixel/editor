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
import {
  counterCommandProtocol,
  counterSnapshotSchema,
  linkCommandProtocol
} from "./protocols.ts";

export const COUNTER_INCREMENTED = "counter.incremented";

export interface CounterState {
  value: number;
}

export interface CounterCommand {
  action: "increment";
}

const kCounterCommands: AssetCommands<CounterState, CounterCommand> = {
  eventType: COUNTER_INCREMENTED,
  protocol: counterCommandProtocol,
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
          snapshotSchema: counterSnapshotSchema,
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

export const LINK_TARGETS_SET = "link.targets-set";

export interface LinkState {
  targets: string[];
}

export interface LinkCommand {
  action: "set";
  targets: string[];
}

export function linkReference(
  id: string
): { id: string; kind: string; } {
  return {
    id,
    kind: "binary"
  };
}

export function linkContent(
  ...targets: string[]
): Uint8Array {
  return bytes(targets.join(","));
}

export function linkHandler(): AssetKindHandler<LinkState, LinkCommand> {
  return {
    kind: "link",
    match: ["**/*.link"],
    commands: {
      eventType: LINK_TARGETS_SET,
      protocol: linkCommandProtocol,
      apply: (state, command) => {
        state.targets = [...command.targets];
      }
    },

    create(): LinkState {
      return { targets: [] };
    },

    load(
      state: LinkState,
      content: Uint8Array
    ): void {
      const value = text(content);
      if (value === "!") {
        throw new Error("unreadable link");
      }
      state.targets = value.length === 0 ? [] : value.split(",");
    },

    clear(
      state: LinkState
    ): void {
      state.targets = [];
    },

    serialize(
      state: LinkState
    ): Promise<Uint8Array> {
      return Promise.resolve(linkContent(...state.targets));
    },

    dependencies(
      state: LinkState
    ) {
      return state.targets.map(linkReference);
    }
  };
}
