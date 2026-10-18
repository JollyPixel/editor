// Import Internal Dependencies
import type { JollyOption } from "./types.ts";

export interface OptionGroup {
  readonly label: string;
  readonly indices: readonly number[];
}

export class OptionGroups<TValue> implements Iterable<OptionGroup> {
  readonly options: readonly JollyOption<TValue>[];
  readonly #groups: readonly OptionGroup[];

  constructor(
    options: readonly JollyOption<TValue>[]
  ) {
    const groups: { label: string; indices: number[]; }[] = [];
    options.forEach((option, index) => {
      const label = option.group ?? "";
      const last = groups.at(-1);
      if (last?.label === label) {
        last.indices.push(index);
      }
      else {
        groups.push({
          label,
          indices: [index]
        });
      }
    });

    this.options = options;
    this.#groups = groups;
  }

  [Symbol.iterator](): IterableIterator<OptionGroup> {
    return this.#groups.values();
  }
}
