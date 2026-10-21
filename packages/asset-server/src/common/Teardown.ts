// Import Internal Dependencies
import { asError } from "./asError.ts";

export type TeardownStep = () => unknown;

export class Teardown {
  #steps: TeardownStep[] = [];

  defer(
    step: TeardownStep
  ): void {
    this.#steps.push(step);
  }

  async run(): Promise<void> {
    const failures = await this.#runSteps();
    if (failures.length === 1) {
      throw failures[0];
    }
    if (failures.length > 1) {
      throw new AggregateError(failures, "Teardown failed.");
    }
  }

  async unwind(
    error: unknown
  ): Promise<never> {
    const failures = await this.#runSteps();
    if (failures.length === 0) {
      throw error;
    }

    throw new AggregateError(
      [error, ...failures],
      asError(error).message
    );
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
