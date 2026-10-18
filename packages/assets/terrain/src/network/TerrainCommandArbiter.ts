// Import Third-party Dependencies
import * as network from "@jolly-pixel/network";
import type { TerrainReader } from "@jolly-pixel/terrain.renderer";

// Import Internal Dependencies
import { acceptsTerrainCommand } from "../model/terrainState.ts";
import { terrainWriteKeys } from "./TerrainCommandKeys.ts";
import type { TerrainNetworkCommand } from "./types.ts";

export interface TerrainCommandArbiterOptions {
  conflictResolver?: network.ConflictResolver<TerrainNetworkCommand>;
}

export class TerrainCommandArbiter {
  #tracker: network.ConflictTracker<TerrainNetworkCommand>;

  constructor(
    options: TerrainCommandArbiterOptions = {}
  ) {
    this.#tracker = new network.ConflictTracker(
      options.conflictResolver ?? new network.LastWriteWinsResolver()
    );
  }

  admit<TCommand extends TerrainNetworkCommand>(
    terrain: TerrainReader,
    command: TCommand
  ): network.Admission<TCommand> | null {
    if (!acceptsTerrainCommand(terrain, command)) {
      return null;
    }

    return this.#tracker.admit(command, terrainWriteKeys(command));
  }

  restore(
    command: TerrainNetworkCommand,
    version: number
  ): void {
    this.#tracker.record(command, terrainWriteKeys(command), version);
  }
}
