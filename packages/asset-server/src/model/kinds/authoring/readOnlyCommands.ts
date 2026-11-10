// Import Third-party Dependencies
import {
  MessageProtocol,
  type Schema
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type {
  AssetCommands,
  AssetRoomBinding
} from "../AssetKindHandler.ts";

export interface ReadOnlyCommandsOptions<TState> {
  readonly eventType: string;
  readonly snapshotSchema: Schema;
  readonly compressSnapshot?: boolean;

  snapshot(
    state: TState
  ): unknown;

  encodeSnapshot?(
    binding: AssetRoomBinding<TState>
  ): Promise<unknown>;
}

export function readOnlyCommands<TState>(
  options: ReadOnlyCommandsOptions<TState>
): AssetCommands<TState, never> {
  const {
    eventType,
    snapshotSchema,
    compressSnapshot,
    snapshot,
    encodeSnapshot
  } = options;

  return {
    eventType,
    protocol: MessageProtocol.EMPTY,
    apply: () => undefined,
    live: (binding) => {
      return {
        snapshotSchema,
        compressSnapshot,
        snapshot: () => snapshot(binding.state),
        encodeSnapshot: encodeSnapshot === undefined ?
          undefined :
          () => encodeSnapshot(binding),
        arbitrate: () => null
      };
    }
  };
}
