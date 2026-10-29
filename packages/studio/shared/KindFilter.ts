// Import Internal Dependencies
import type { KindFilterSection } from "./api/project.ts";

export class KindFilter {
  static readonly NONE = new KindFilter([]);

  static from(
    section: KindFilterSection
  ): KindFilter {
    return new KindFilter(section.hidden);
  }

  #hidden: readonly string[];

  constructor(
    hidden: Iterable<string>
  ) {
    this.#hidden = Object.freeze([
      ...new Set(hidden)
    ].sort());
  }

  get hidden(): readonly string[] {
    return this.#hidden;
  }

  shows(
    kind: string
  ): boolean {
    return !this.#hidden.includes(kind);
  }

  with(
    kind: string,
    shown: boolean
  ): KindFilter {
    return new KindFilter(
      shown ?
        this.#hidden.filter((hidden) => hidden !== kind) :
        [...this.#hidden, kind]
    );
  }

  equals(
    other: KindFilter
  ): boolean {
    return this.#hidden.length === other.#hidden.length &&
      this.#hidden.every((kind, index) => kind === other.#hidden[index]);
  }

  toJSON(): KindFilterSection {
    return {
      hidden: [...this.#hidden]
    };
  }
}
