// Import Internal Dependencies
import {
  throwFailures,
  throwWithFailures
} from "./failures.ts";

export type AsyncTeardownStep = () => unknown;

export class AsyncTeardown {
  readonly #steps: AsyncTeardownStep[] = [];

  defer(
    step: AsyncTeardownStep
  ): void {
    this.#steps.push(step);
  }

  async run(): Promise<void> {
    throwFailures(await this.#runSteps());
  }

  async unwind(
    error: unknown
  ): Promise<never> {
    throwWithFailures(error, await this.#runSteps());
  }

  async #runSteps(): Promise<unknown[]> {
    const failures: unknown[] = [];
    for (const step of this.#steps.splice(0).reverse()) {
      try {
        await step();
      }
      catch (failure) {
        failures.push(failure);
      }
    }

    return failures;
  }
}
