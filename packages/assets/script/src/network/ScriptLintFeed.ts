// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import type { Room } from "@jolly-pixel/network/client";
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  lintMessageSchema,
  SCRIPT_LINT_REQUESTED,
  type ScriptLintRequest
} from "./ScriptCommand.schema.ts";
import { textFingerprint } from "./textFingerprint.ts";

export type ScriptLintFeedEvents = {
  change: (diagnostics: readonly ScriptDiagnostic[]) => void;
};

export class ScriptLintFeed extends Emitter<ScriptLintFeedEvents> {
  #room: Room;
  #text: () => string;

  #onMessage = (
    message: unknown
  ): void => {
    const parsed = z.safeParse(lintMessageSchema, message);
    if (
      parsed.success &&
      parsed.data.fingerprint === textFingerprint(this.#text())
    ) {
      this.emit("change", parsed.data.diagnostics);
    }
  };

  constructor(
    room: Room,
    text: () => string
  ) {
    super();
    this.#room = room;
    this.#text = text;
    this.#room.on("message", this.#onMessage);
  }

  request(): void {
    this.#room.send({
      action: SCRIPT_LINT_REQUESTED
    } satisfies ScriptLintRequest);
  }

  dispose(): void {
    this.#room.off("message", this.#onMessage);
  }
}
