// Import Internal Dependencies
import {
  throwFailures,
  throwWithFailures
} from "./failures.ts";

export type TeardownStep = () => void;

export class Teardown {
  readonly #steps: TeardownStep[] = [];
  #controller: AbortController | null = null;
  #closed = false;

  get signal(): AbortSignal {
    if (this.#controller === null) {
      this.#controller = new AbortController();
      if (this.#closed) {
        this.#controller.abort();
      }
    }

    return this.#controller.signal;
  }

  defer(
    step: TeardownStep
  ): void {
    if (this.#closed) {
      step();
    }
    else {
      this.#steps.push(step);
    }
  }

  run(): void {
    throwFailures(this.#runSteps());
  }

  unwind(
    error: unknown
  ): never {
    throwWithFailures(error, this.#runSteps());
  }

  #runSteps(): unknown[] {
    this.#closed = true;
    this.#controller?.abort();
    const failures: unknown[] = [];
    for (const step of this.#steps.splice(0).reverse()) {
      try {
        step();
      }
      catch (failure) {
        failures.push(failure);
      }
    }

    return failures;
  }
}
