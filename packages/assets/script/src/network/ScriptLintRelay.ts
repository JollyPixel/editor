// Import Third-party Dependencies
import type { AssetRelay } from "@jolly-pixel/asset-server";
import type { RoomBroadcast } from "@jolly-pixel/network";
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";

// Import Internal Dependencies
import type { ScriptText } from "../model/ScriptText.ts";
import {
  SCRIPT_LINT,
  type ScriptLintMessage,
  type ScriptLintRequest
} from "./ScriptCommand.schema.ts";
import { textFingerprint } from "./textFingerprint.ts";

export type ScriptLinter = (
  text: string
) => Promise<ScriptDiagnostic[] | null>;

interface LintedText {
  readonly text: string;
  readonly diagnostics: ScriptDiagnostic[] | null;
}

export class ScriptLintRelay implements AssetRelay<ScriptLintRequest> {
  #state: ScriptText;
  #lint: ScriptLinter;
  #last: LintedText | null = null;
  #waiting = new Set<string>();
  #draining = false;

  constructor(
    state: ScriptText,
    lint: ScriptLinter
  ) {
    this.#state = state;
    this.#lint = lint;
  }

  receive(
    clientId: string,
    _message: ScriptLintRequest,
    room: RoomBroadcast
  ): void {
    this.#waiting.add(clientId);
    if (!this.#draining) {
      this.#draining = true;
      void this.#drain(room);
    }
  }

  leave(
    clientId: string
  ): void {
    this.#waiting.delete(clientId);
  }

  async #drain(
    room: RoomBroadcast
  ): Promise<void> {
    while (this.#waiting.size > 0) {
      const clients = Array.from(this.#waiting);
      this.#waiting.clear();
      try {
        const { text, diagnostics } = await this.#lintCurrent();
        if (diagnostics !== null) {
          const message: ScriptLintMessage = {
            type: SCRIPT_LINT,
            fingerprint: textFingerprint(text),
            diagnostics
          };
          for (const clientId of clients) {
            room.sendTo(clientId, message);
          }
        }
      }
      catch (error) {
        console.error("Script lint failed", error);
      }
    }
    this.#draining = false;
  }

  async #lintCurrent(): Promise<LintedText> {
    const { text } = this.#state;
    if (this.#last?.text !== text) {
      this.#last = {
        text,
        diagnostics: await this.#lint(text)
      };
    }

    return this.#last;
  }
}
