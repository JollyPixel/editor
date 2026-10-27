// Import Third-party Dependencies
import {
  KeyedCommandArbiter,
  type KeyedCommandArbiterOptions,
  type NetworkCommandHeader
} from "@jolly-pixel/network";

// Import Internal Dependencies
import type { AssetLiveProtocol } from "./AssetLiveProtocol.ts";

export type ArbitratedLive<TCommand extends NetworkCommandHeader> = Required<
  Pick<AssetLiveProtocol<TCommand>, "arbitrate" | "restore">
>;

export function arbitrated<
  TCommand extends NetworkCommandHeader,
  TState
>(
  state: TState,
  rules: KeyedCommandArbiterOptions<TCommand, TState>
): ArbitratedLive<TCommand> {
  const arbiter = new KeyedCommandArbiter(rules);

  return {
    arbitrate: (command) => arbiter.admit(state, command),
    restore: (command, version) => arbiter.restore(command, version)
  };
}
