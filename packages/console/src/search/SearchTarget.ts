// Import Internal Dependencies
import { label } from "../registry/format.ts";
import type { RegisteredEntry } from "../registry/types.ts";
import { SearchText } from "./SearchText.ts";

export class SearchTarget {
  static #cache = new WeakMap<RegisteredEntry, SearchTarget>();

  static of(
    entry: RegisteredEntry
  ): SearchTarget {
    let target = SearchTarget.#cache.get(entry);
    if (target === undefined) {
      target = new SearchTarget(entry);
      SearchTarget.#cache.set(entry, target);
    }

    return target;
  }

  readonly entry: RegisteredEntry;
  readonly label: string;
  readonly address: SearchText;
  readonly description: SearchText;

  constructor(
    entry: RegisteredEntry
  ) {
    this.entry = entry;
    this.label = label(entry);
    this.address = new SearchText(entry.address);
    this.description = new SearchText(entry.description);
  }
}
