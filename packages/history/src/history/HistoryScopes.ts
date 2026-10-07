// Import Internal Dependencies
import type { HistoryStep } from "./HistoryStep.ts";
import { ScopeStacks } from "./ScopeStacks.ts";

export class HistoryScopes<
  TScope extends string
> {
  readonly limit: number;

  #stacks = new Map<TScope, ScopeStacks<TScope>>();

  constructor(
    scopes: readonly TScope[],
    limit: number
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`CommandHistory: limit must be a positive integer, got ${limit}.`);
    }

    this.limit = limit;
    for (const scope of scopes) {
      this.#stacks.set(
        scope,
        new ScopeStacks(limit)
      );
    }
  }

  get(
    scope: TScope
  ): ScopeStacks<TScope> {
    const stacks = this.#stacks.get(scope);
    if (stacks === undefined) {
      throw new Error(`CommandHistory: unknown scope "${scope}".`);
    }

    return stacks;
  }

  clear(): void {
    for (const stacks of this.#stacks.values()) {
      stacks.clear();
    }
  }

  * [Symbol.iterator](): IterableIterator<HistoryStep<TScope>> {
    for (const stacks of this.#stacks.values()) {
      yield* stacks;
    }
  }
}
