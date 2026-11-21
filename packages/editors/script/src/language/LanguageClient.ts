// Import Internal Dependencies
import type {
  LanguageAnswers,
  LanguageMessage,
  LanguageQuestion,
  LanguageQuestions,
  LanguageReply
} from "./languageProtocol.ts";

export interface LanguageClientOptions {
  path: string;
  crashed: (error: Error) => void;
}

interface PendingQuestion {
  resolve(answer: unknown): void;
  reject(error: Error): void;
}

export class LanguageClient implements LanguageQuestions {
  #worker: Worker;
  #pending = new Map<number, PendingQuestion>();
  #nextId = 0;
  #failure: Error | null = null;

  constructor(
    options: LanguageClientOptions
  ) {
    const { path, crashed } = options;
    this.#worker = new Worker(
      new URL("./languageWorker.ts", import.meta.url),
      { type: "module" }
    );
    this.#worker.addEventListener("message", (event: MessageEvent<LanguageReply>) => {
      this.#settle(event.data);
    });
    this.#worker.addEventListener("error", (event) => {
      const error = new Error(`Language service crashed: ${event.message}`);
      this.#fail(error);
      crashed(error);
    });
    this.#post({
      type: "open",
      path
    });
  }

  diagnostics(
    text: string
  ): Promise<LanguageAnswers["diagnostics"]> {
    return this.#ask("diagnostics", text, 0);
  }

  completions(
    text: string,
    offset: number
  ): Promise<LanguageAnswers["completions"]> {
    return this.#ask("completions", text, offset);
  }

  quickInfo(
    text: string,
    offset: number
  ): Promise<LanguageAnswers["quickInfo"]> {
    return this.#ask("quickInfo", text, offset);
  }

  dispose(): void {
    this.#fail(new Error("Language service disposed."));
    this.#worker.terminate();
  }

  #ask<TQuestion extends LanguageQuestion>(
    type: TQuestion,
    text: string,
    offset: number
  ): Promise<LanguageAnswers[TQuestion]> {
    if (this.#failure !== null) {
      return Promise.reject(this.#failure);
    }

    const id = this.#nextId++;
    const answer = new Promise<LanguageAnswers[TQuestion]>((resolve, reject) => {
      this.#pending.set(id, {
        resolve: (value) => resolve(value as LanguageAnswers[TQuestion]),
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
    message: LanguageMessage
  ): void {
    this.#worker.postMessage(message);
  }

  #settle(
    reply: LanguageReply
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
