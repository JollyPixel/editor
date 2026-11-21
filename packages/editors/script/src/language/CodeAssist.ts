// Import Third-party Dependencies
import {
  ScriptLintFeed,
  type ScriptDocument
} from "@jolly-pixel/asset.script/client";
import type { Room } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import { CodeDiagnostics } from "./CodeDiagnostics.ts";
import { LatestQuestion } from "./LatestQuestion.ts";
import type { LanguageQuestions } from "./languageProtocol.ts";

export interface CodeAssistOptions {
  questions: LanguageQuestions;
  document: ScriptDocument;
  room: Room;
}

// CONSTANTS
const kRefreshDelayMs = 400;

export class CodeAssist {
  readonly questions: LanguageQuestions;
  readonly diagnostics = new CodeDiagnostics();

  #lint: ScriptLintFeed;
  #types: LatestQuestion;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #unsubscribe: () => void;

  constructor(
    options: CodeAssistOptions
  ) {
    const { questions, document, room } = options;
    this.questions = questions;
    this.#lint = new ScriptLintFeed(room, () => document.text);
    this.#lint.on("change", (found) => this.diagnostics.replace("lint", found));
    this.#types = new LatestQuestion(() => document.text);
    this.#unsubscribe = document.subscribe("change", (change) => {
      this.diagnostics.follow(change);
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#refresh(), kRefreshDelayMs);
    });
    this.#refresh();
  }

  dispose(): void {
    clearTimeout(this.#timer);
    this.#types.cancel();
    this.#unsubscribe();
    this.#lint.dispose();
    this.diagnostics.removeAllListeners();
  }

  #refresh(): void {
    this.#lint.request();
    this.#types.ask(
      (text) => this.questions.diagnostics(text),
      (found) => this.diagnostics.replace("types", found)
    );
  }
}
