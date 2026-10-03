// CONSTANTS
const kWildcard = "*";

export class RightsPattern {
  readonly source: string;

  #literals: readonly string[];

  constructor(
    source: string
  ) {
    this.source = source;
    this.#literals = source.split(kWildcard);
  }

  matches(
    key: string
  ): boolean {
    const literals = this.#literals;
    if (literals.length === 1) {
      return key === this.source;
    }

    const head = literals[0];
    const tail = literals[literals.length - 1];
    if (!key.startsWith(head)) {
      return false;
    }

    let position = head.length;
    for (const literal of literals.slice(1, -1)) {
      const index = key.indexOf(literal, position);
      if (index === -1) {
        return false;
      }
      position = index + literal.length;
    }

    return key.length - tail.length >= position && key.endsWith(tail);
  }
}
