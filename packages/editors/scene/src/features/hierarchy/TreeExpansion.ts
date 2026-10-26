export class TreeExpansion {
  readonly #collapsed = new Set<string>();

  expand(
    id: string
  ): void {
    this.#collapsed.delete(id);
  }

  collapse(
    id: string
  ): void {
    this.#collapsed.add(id);
  }

  reveal(
    ids: Iterable<string>
  ): void {
    for (const id of ids) {
      this.#collapsed.delete(id);
    }
  }

  expanded(
    ids: Iterable<string>
  ): string[] {
    return [...ids].filter((id) => !this.#collapsed.has(id));
  }

  clear(): void {
    this.#collapsed.clear();
  }
}
