export class ExpandedRows {
  #ids: string[] = [];

  get ids(): string[] {
    return this.#ids;
  }

  has(
    id: string
  ): boolean {
    return this.#ids.includes(id);
  }

  expand(
    id: string
  ): void {
    if (!this.has(id)) {
      this.#ids = [...this.#ids, id];
    }
  }

  set(
    id: string,
    expanded: boolean
  ): void {
    if (expanded) {
      this.expand(id);
    }
    else if (this.has(id)) {
      this.#ids = this.#ids.filter((expandedId) => expandedId !== id);
    }
  }

  toggle(
    id: string
  ): void {
    this.set(id, !this.has(id));
  }

  reset(
    ids: Iterable<string>
  ): void {
    this.#ids = [...ids];
  }
}
