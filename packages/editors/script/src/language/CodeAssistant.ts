// Import Third-party Dependencies
import type { ScriptDiagnostic } from "@jolly-pixel/scripting";
import type {
  ScriptCompletion,
  ScriptQuickInfo
} from "@jolly-pixel/scripting/language";

// Import Internal Dependencies
import type {
  AssistantAnswers,
  AssistantMessage,
  AssistantQuestion,
  AssistantReply
} from "./assistantProtocol.ts";

interface PendingQuestion {
  resolve(answer: unknown): void;
  reject(error: Error): void;
}

export class CodeAssistant {
  #worker: Worker;
  #pending = new Map<number, PendingQuestion>();
  #nextId = 0;
  #failure: Error | null = null;

  constructor(
    path: string
  ) {
    this.#worker = new Worker(
      new URL("./assistantWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.#worker.addEventListener("message", (event: MessageEvent<AssistantReply>) => {
      this.#settle(event.data);
    });
    this.#worker.addEventListener("error", (event) => {
      this.#fail(new Error(`Code assistant failed: ${event.message}`));
    });
    this.#post({
      type: "open",
      path
    });
  }

  diagnostics(
    text: string
  ): Promise<ScriptDiagnostic[]> {
    return this.#ask("diagnostics", text, 0);
  }

  completions(
    text: string,
    offset: number
  ): Promise<ScriptCompletion[]> {
    return this.#ask("completions", text, offset);
  }

  quickInfo(
    text: string,
    offset: number
  ): Promise<ScriptQuickInfo | null> {
    return this.#ask("quickInfo", text, offset);
  }

  dispose(): void {
    this.#fail(new Error("Code assistant disposed."));
    this.#worker.terminate();
  }

  #ask<TQuestion extends AssistantQuestion>(
    type: TQuestion,
    text: string,
    offset: number
  ): Promise<AssistantAnswers[TQuestion]> {
    if (this.#failure !== null) {
      return Promise.reject(this.#failure);
    }

    const id = this.#nextId++;
    const answer = new Promise<AssistantAnswers[TQuestion]>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as AssistantAnswers[TQuestion]),
        reject
      });
    });
    this.#post({
      type,
      id,
      text,
      offset
    });

    return answer;
  }

  #post(
    message: AssistantMessage
  ): void {
    this.#worker.postMessage(message);
  }

  #settle(
    reply: AssistantReply
  ): void {
    const pending = this.#pending.get(reply.id);
    this.#pending.delete(reply.id);
    if (pending === undefined) {
      return;
    }

    if ("error" in reply) {
      pending.reject(new Error(reply.error));
    }
    else {
      pending.resolve(reply.answer);
    }
  }

  #fail(
    error: Error
  ): void {
    this.#failure ??= error;
    for (const pending of this.#pending.values()) {
      pending.reject(error);
    }
    this.#pending.clear();
  }
}
