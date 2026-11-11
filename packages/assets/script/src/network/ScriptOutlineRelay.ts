// Import Third-party Dependencies
import type { AssetRelay } from "@jolly-pixel/asset-server";
import type { RoomBroadcast } from "@jolly-pixel/network";
import type { ScriptOutline } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import type { ScriptText } from "../model/ScriptText.ts";
import {
  SCRIPT_OUTLINE,
  type ScriptOutlineMessage,
  type ScriptOutlineRequest
} from "./ScriptCommand.schema.ts";

export type ScriptOutlineReader = (
  text: string
) => Promise<ScriptOutline | null>;

interface ReadOutline {
  readonly text: string;
  readonly outline: Promise<ScriptOutline | null>;
}

export class ScriptOutlineRelay implements AssetRelay<ScriptOutlineRequest> {
  #state: ScriptText;
  #read: ScriptOutlineReader;
  #last: ReadOutline | null = null;

  constructor(
    state: ScriptText,
    read: ScriptOutlineReader
  ) {
    this.#state = state;
    this.#read = read;
  }

  receive(
    _clientId: string,
    _message: ScriptOutlineRequest,
    room: RoomBroadcast
  ): void {
    void this.#outline().then(
      (outline) => {
        if (outline !== null) {
          room.broadcast({
            type: SCRIPT_OUTLINE,
            outline
          } satisfies ScriptOutlineMessage);
        }
      },
      (error: unknown) => console.error("Script outline failed", error)
    );
  }

  #outline(): Promise<ScriptOutline | null> {
    const { text } = this.#state;
    if (this.#last?.text !== text) {
      this.#last = {
        text,
        outline: this.#read(text)
      };
    }

    return this.#last.outline;
  }
}
