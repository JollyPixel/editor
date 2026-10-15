export class TargetPath implements Iterable<string> {
  readonly selectors: readonly string[];

  constructor(
    selectors: Iterable<string>
  ) {
    this.selectors = Object.freeze([
      ...selectors
    ]);
  }

  resolve(
    root: ParentNode = document
  ): Element | null {
    let scope: ParentNode = root;
    let match: Element | null = null;
    for (const selector of this.selectors) {
      if (match !== null) {
        scope = match.shadowRoot ?? match;
      }
      match = scope.querySelector(selector);
      if (match === null) {
        return null;
      }
    }

    return match;
  }

  toString(): string {
    return this.selectors.join(" > ");
  }

  * [Symbol.iterator](): IterableIterator<string> {
    yield* this.selectors;
  }
}
