// Import Third-party Dependencies
import {
  MessageProtocol,
  type Schema
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetCommands } from "./AssetKindHandler.ts";

export interface ReadOnlyCommandsOptions<TState> {
  readonly eventType: string;
  readonly snapshotSchema: Schema;
  readonly compressSnapshot?: boolean;

  snapshot(
    state: TState
  ): unknown;
}

export function readOnlyCommands<TState>(
  options: ReadOnlyCommandsOptions<TState>
): AssetCommands<TState, never> {
  const {
    eventType,
    snapshotSchema,
    compressSnapshot,
    snapshot
  } = options;

  return {
    eventType,
    protocol: MessageProtocol.EMPTY,
    apply: () => undefined,
    live: ({ state }) => {
      return {
        snapshotSchema,
        compressSnapshot,
        snapshot: () => snapshot(state),
        arbitrate: () => null
      };
    }
  };
}
