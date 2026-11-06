export class TreeExpansion {
  readonly #expanded = new Set<string>();

  expand(
    id: string
  ): void {
    this.#expanded.add(id);
  }

  collapse(
    id: string
  ): void {
    this.#expanded.delete(id);
  }

  reveal(
    ids: Iterable<string>
  ): void {
    for (const id of ids) {
      this.#expanded.add(id);
    }
  }

  expanded(
    ids: Iterable<string>
  ): string[] {
    return [...ids].filter((id) => this.#expanded.has(id));
  }

  clear(): void {
    this.#expanded.clear();
  }
}
