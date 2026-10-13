// Import Internal Dependencies
import type { HostLogger } from "../debug/readDebugLogger.ts";
import type { EditorState } from "../state/EditorState.ts";
import type { PageState } from "../state/PageState.ts";

export class BootTrace {
  readonly logger: HostLogger;

  #page: PageState;
  #step: string | null = null;

  constructor(
    logger: HostLogger,
    page: PageState
  ) {
    this.logger = logger;
    this.#page = page;
  }

  retrace(
    logger: HostLogger
  ): BootTrace {
    return new BootTrace(logger, this.#page);
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
    this.#page.show(state);
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
