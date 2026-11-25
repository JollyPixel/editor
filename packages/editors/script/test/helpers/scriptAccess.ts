// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import {
  RoomGrants,
  type Right,
  type RoomEventMap
} from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  SCRIPT_CAPABILITY_TABLE,
  type ScriptGrants
} from "#src/access/ScriptAccess.ts";

export class FakeScriptRoom extends Emitter<RoomEventMap> {
  readonly clientId = "local";

  #right: Right;

  constructor(
    right: Right
  ) {
    super();
    this.#right = right;
  }

  can(): Right {
    return this.#right;
  }

  allow(): void {
    this.#right = "write";
    this.emit("rights");
  }
}

export function scriptGrants(
  room: FakeScriptRoom
): ScriptGrants {
  return new RoomGrants(room, SCRIPT_CAPABILITY_TABLE);
}
