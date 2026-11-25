// Import Third-party Dependencies
import type { EnvironmentCommand } from "@jolly-pixel/asset.environment/client";
import {
  Grants,
  type RoomGrantsEventMap
} from "@jolly-pixel/network/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  ENVIRONMENT_CAPABILITY_TABLE,
  type EnvironmentCapability
} from "../../src/access/EnvironmentAccess.ts";

export class TestEnvironmentAccess extends Emitter<
  RoomGrantsEventMap<EnvironmentCommand["action"], EnvironmentCapability>
> {
  current: Grants<EnvironmentCapability> = ENVIRONMENT_CAPABILITY_TABLE.full;

  grant(
    ...capabilities: [EnvironmentCapability, ...EnvironmentCapability[]]
  ): void {
    this.#set(capabilities);
  }

  viewOnly(): void {
    this.#set([]);
  }

  #set(
    capabilities: Iterable<EnvironmentCapability>
  ): void {
    this.current = new Grants(capabilities);
    this.emit("change", this.current);
  }
}
