// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { Room } from "@jolly-pixel/network/client";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { ScriptOutline } from "../outline/ScriptOutline.schema.ts";
import {
  outlineMessageSchema,
  SCRIPT_OUTLINE_REQUESTED,
  type ScriptOutlineRequest
} from "./ScriptCommand.schema.ts";

export type ScriptOutlineFeedEvents = {
  change: (outline: ScriptOutline) => void;
};

export class ScriptOutlineFeed extends Emitter<ScriptOutlineFeedEvents> {
  #room: Room;
  #outline: ScriptOutline | null = null;

  #onMessage = (
    message: unknown
  ): void => {
    const parsed = z.safeParse(outlineMessageSchema, message);
    if (parsed.success) {
      this.#outline = parsed.data.outline;
      this.emit("change", parsed.data.outline);
    }
  };

  constructor(
    room: Room
  ) {
    super();
    this.#room = room;
    this.#room.on("message", this.#onMessage);
  }

  get outline(): ScriptOutline | null {
    return this.#outline;
  }

  request(): void {
    this.#room.send({
      action: SCRIPT_OUTLINE_REQUESTED
    } satisfies ScriptOutlineRequest);
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
  }
}
