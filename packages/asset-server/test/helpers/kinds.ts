// Import Internal Dependencies
import type {
  AssetCommandHeader,
  AssetCommands,
  AssetKindHandler,
  AssetLiveProtocol,
  AssetRelay,
  AssetRelaySchemas,
  AssetRoomBinding,
  SnapshotPolicy
} from "#src/index.ts";
import {
  bytes,
  text
} from "./bytes.ts";
import {
  counterCommandProtocol,
  counterSnapshotSchema,
  linkCommandProtocol,
  linkSnapshotSchema,
  tileCommandProtocol
} from "./protocols.ts";

export const COUNTER_INCREMENTED = "counter.incremented";

export interface CounterState {
  value: number;
}

export interface CounterCommand extends AssetCommandHeader {
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
    extensions: { ".counter": "text/plain; charset=utf-8" },
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

function counterLive(
  binding: AssetRoomBinding<CounterState>
): AssetLiveProtocol<CounterCommand> {
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

export function liveCounterHandler(
  snapshot?: SnapshotPolicy
): AssetKindHandler<CounterState, CounterCommand> {
  return {
    ...counterHandler(snapshot),
    commands: {
      ...kCounterCommands,
      live: counterLive
    }
  };
}

export function failingLiveCounterHandler(): AssetKindHandler<CounterState, CounterCommand> {
  return {
    ...counterHandler({ delay: 0, maxDelay: 0 }),
    commands: {
      ...kCounterCommands,
      live: () => {
        throw new Error("live protocol unavailable");
      }
    }
  };
}

export function relayCounterHandler<TRelay extends object>(
  schemas: AssetRelaySchemas<TRelay>,
  relay: AssetRelay<TRelay>
): AssetKindHandler<CounterState, CounterCommand, TRelay> {
  return {
    ...counterHandler({ delay: 0, maxDelay: 0 }),
    commands: {
      ...kCounterCommands,
      relay: schemas,
      live: (binding) => {
        return {
          ...counterLive(binding),
          relay
        };
      }
    }
  };
}

export const LINK_TARGETS_SET = "link.targets-set";

export interface LinkState {
  targets: string[];
}

export interface LinkCommand extends AssetCommandHeader {
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

const kLinkCommands: AssetCommands<LinkState, LinkCommand> = {
  eventType: LINK_TARGETS_SET,
  protocol: linkCommandProtocol,
  apply: (state, command) => {
    state.targets = [...command.targets];
  }
};

export function linkHandler(): AssetKindHandler<LinkState, LinkCommand> {
  return {
    kind: "link",
    extensions: { ".link": "text/plain; charset=utf-8" },
    commands: kLinkCommands,

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
    },

    rebind(
      state: LinkState,
      idMap: ReadonlyMap<string, string>
    ): void {
      state.targets = state.targets.map((id) => idMap.get(id) ?? id);
    }
  };
}

export function liveLinkHandler(): AssetKindHandler<LinkState, LinkCommand> {
  return {
    ...linkHandler(),
    commands: {
      ...kLinkCommands,
      live: (binding) => {
        return {
          snapshotSchema: linkSnapshotSchema,
          snapshot: () => {
            return { targets: [...binding.state.targets] };
          },
          arbitrate: (command) => {
            return { command };
          }
        };
      }
    }
  };
}

export function ownerHandler(
  companionKinds: readonly string[] = ["counter"]
): AssetKindHandler<LinkState, LinkCommand> {
  return {
    ...linkHandler(),
    kind: "owner",
    extensions: { ".owner": "text/plain; charset=utf-8" },
    commands: undefined,
    companions: companionKinds.map((kind) => {
      return {
        kind,
        link: (state, companion) => {
          state.targets.push(companion.id);
        }
      };
    })
  };
}

export const TILE_CHANGED = "tile.changed";

export interface TileState {
  tiles: Map<string, string>;
}

export type TileCommand = AssetCommandHeader & (
  | { action: "paint"; tile: string; value: string; }
  | { action: "erase"; tile: string; }
);

export function tileHandler(
  snapshot?: SnapshotPolicy
): AssetKindHandler<TileState, TileCommand> {
  return {
    kind: "tiles",
    extensions: { ".tiles": "text/plain; charset=utf-8" },
    snapshot,
    commands: {
      eventType: TILE_CHANGED,
      protocol: tileCommandProtocol,
      apply: (state, command) => {
        if (command.action === "paint") {
          state.tiles.set(command.tile, command.value);
        }
        else {
          state.tiles.delete(command.tile);
        }
      }
    },
    parts: {
      extension: { ".tile": "text/plain; charset=utf-8" },
      touched: (command) => [command.tile],
      list: (state) => state.tiles.keys(),
      load: (state, partId, content) => {
        state.tiles.set(partId, text(content));
      },
      serialize: (state, partId) => Promise.resolve(
        bytes(state.tiles.get(partId) ?? "")
      )
    },

    create(): TileState {
      return {
        tiles: new Map([["a", "grass"]])
      };
    },

    load(
      state: TileState,
      content: Uint8Array
    ): void {
      const listed = text(content);
      state.tiles = new Map(
        listed.length === 0 ?
          [] :
          listed.split(",").map((tile) => [tile, ""])
      );
    },

    clear(
      state: TileState
    ): void {
      state.tiles.clear();
    },

    serialize(
      state: TileState
    ): Promise<Uint8Array> {
      return Promise.resolve(bytes([...state.tiles.keys()].sort().join(",")));
    }
  };
}
