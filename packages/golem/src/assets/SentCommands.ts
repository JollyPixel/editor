// Import Internal Dependencies
import { CommandRefusedError } from "./errors/CommandRefusedError.ts";

export class SentCommands<TCommand> {
  #unanswered = new Map<object, TCommand>();
  #refused: TCommand[] = [];
  #failure: Error | null = null;
  #drain: PromiseWithResolvers<void> | null = null;

  get unanswered(): number {
    return this.#unanswered.size;
  }

  get failure(): Error | null {
    return this.#failure;
  }

  track(
    change: object,
    command: TCommand
  ): void {
    this.#unanswered.set(change, command);
  }

  confirm(
    change: object
  ): void {
    if (this.#unanswered.delete(change)) {
      this.#noteAnswered();
    }
  }

  refuse(
    change: object
  ): void {
    const command = this.#unanswered.get(change);
    if (command !== undefined) {
      this.#unanswered.delete(change);
      this.#refused.push(command);
      this.#noteAnswered();
    }
  }

  fail(
    error: Error
  ): void {
    this.#failure ??= error;
    this.#unanswered.clear();
    this.#drain?.reject(this.#failure);
    this.#drain = null;
  }

  drained(): Promise<void> {
    if (this.#failure !== null) {
      return Promise.reject(this.#failure);
    }
    if (this.#unanswered.size === 0) {
      return Promise.resolve();
    }

    this.#drain ??= Promise.withResolvers<void>();

    return this.#drain.promise;
  }

  async settled(): Promise<void> {
    await this.drained();
    const refused = this.#refused.splice(0);
    if (refused.length > 0) {
      throw new CommandRefusedError(refused);
    }
  }

  #noteAnswered(): void {
    if (this.#unanswered.size === 0) {
      this.#drain?.resolve();
      this.#drain = null;
    }
  }
}
