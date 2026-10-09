// Import Internal Dependencies
import type { HistoryStep } from "./HistoryStep.ts";
import { ScopeStacks } from "./ScopeStacks.ts";

export class HistoryScopes<
  TScope extends string
> {
  readonly limit: number;

  #stacks = new Map<TScope, ScopeStacks<TScope>>();

  constructor(
    limit: number
  ) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`CommandHistory: limit must be a positive integer, got ${limit}.`);
    }

    this.limit = limit;
  }

  ensure(
    scope: TScope
  ): ScopeStacks<TScope> {
    let stacks = this.#stacks.get(scope);
    if (stacks === undefined) {
      stacks = new ScopeStacks(this.limit);
      this.#stacks.set(scope, stacks);
    }

    return stacks;
  }

  remove(
    scope: TScope
  ): ScopeStacks<TScope> | undefined {
    const stacks = this.#stacks.get(scope);
    this.#stacks.delete(scope);

    return stacks;
  }

  get(
    scope: TScope
  ): ScopeStacks<TScope> | undefined {
    return this.#stacks.get(scope);
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
