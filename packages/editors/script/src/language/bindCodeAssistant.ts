// Import Third-party Dependencies
import {
  ScriptLintFeed,
  type ScriptDocument
} from "@jolly-pixel/asset.script/client";
import type { Room } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { CodeDiagnostics } from "../diagnostics/CodeDiagnostics.ts";
import type { ScriptCode } from "../panes/code/ScriptCode.ts";
import type { CodeAssistant } from "./CodeAssistant.ts";
import { LatestQuestion } from "./LatestQuestion.ts";

export interface CodeAssistantBinding {
  code: ScriptCode;
  assistant: CodeAssistant;
  document: ScriptDocument;
  room: Room;
}

// CONSTANTS
const kRefreshDelayMs = 400;

export function bindCodeAssistant(
  binding: CodeAssistantBinding
): () => void {
  const { code, assistant, document, room } = binding;
  const diagnostics = new CodeDiagnostics(() => code.requestUpdate());
  const lint = new ScriptLintFeed(room, () => document.text);
  const types = new LatestQuestion(() => document.text);
  lint.on("change", (found) => diagnostics.replace("lint", found));
  let timer: ReturnType<typeof setTimeout> | undefined;

  function refresh(): void {
    lint.request();
    types.ask(
      (text) => assistant.diagnostics(text),
      (found) => diagnostics.replace("types", found)
    );
  }

  const unsubscribe = document.subscribe("change", (change) => {
    diagnostics.follow(change);
    clearTimeout(timer);
    timer = setTimeout(refresh, kRefreshDelayMs);
  });
  const release = code.assist({
    assistant,
    diagnostics
  });
  refresh();

  return () => {
    clearTimeout(timer);
    types.cancel();
    unsubscribe();
    lint.dispose();
    release();
  };
}
