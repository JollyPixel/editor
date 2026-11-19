// Import Third-party Dependencies
import type { AssetRelay } from "@jolly-pixel/asset-server";
import type { RoomBroadcast } from "@jolly-pixel/network";

// Import Internal Dependencies
import {
  SCRIPT_LINT_REQUESTED,
  SCRIPT_OUTLINE_REQUESTED,
  type ScriptRelayRequest
} from "./ScriptCommand.schema.ts";
import type { ScriptLintRelay } from "./ScriptLintRelay.ts";
import type { ScriptOutlineRelay } from "./ScriptOutlineRelay.ts";

export class ScriptRelay implements AssetRelay<ScriptRelayRequest> {
  #outline: ScriptOutlineRelay;
  #lint: ScriptLintRelay;

  constructor(
    outline: ScriptOutlineRelay,
    lint: ScriptLintRelay
  ) {
    this.#outline = outline;
    this.#lint = lint;
  }

  receive(
    clientId: string,
    message: ScriptRelayRequest,
    room: RoomBroadcast
  ): void {
    switch (message.action) {
      case SCRIPT_OUTLINE_REQUESTED:
        this.#outline.receive(clientId, message, room);
        break;
      case SCRIPT_LINT_REQUESTED:
        this.#lint.receive(clientId, message, room);
        break;
    }
  }

  leave(
    clientId: string
  ): void {
    this.#lint.leave(clientId);
  }
}
