export class ExpandedRows {
  #ids: string[] = [];

  get ids(): readonly string[] {
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

  toggle(
    id: string,
    expanded = !this.has(id)
  ): void {
    if (expanded) {
      this.expand(id);
    }
    else if (this.has(id)) {
      this.#ids = this.#ids.filter((expandedId) => expandedId !== id);
    }
  }

  reset(
    ids: Iterable<string>
  ): void {
    this.#ids = [...ids];
  }
}
