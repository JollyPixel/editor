// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";

// CONSTANTS
export const EDITOR_STATE_ATTRIBUTE = "data-editor-state";

export type EditorState = "booting" | "ready" | "failed";

export class BootTrace {
  readonly logger: HostLogger;

  #step: string | null = null;

  constructor(
    logger: HostLogger
  ) {
    this.logger = logger;
  }

  async step<T>(
    name: string,
    run: () => Promise<T>
  ): Promise<T> {
    this.#step = name;
    const result = await this.logger.step(name, run);
    this.#step = null;

    return result;
  }

  state(
    state: EditorState
  ): void {
    document.documentElement.setAttribute(EDITOR_STATE_ATTRIBUTE, state);
    this.logger.debug(`state ${state}`);
  }

  fail(
    error: unknown
  ): void {
    if (this.#step === null) {
      this.logger.error("boot failed", {
        error
      });
    }
  }
}
