export class CellCaptures {
  #issued = 0;
  #floor = 0;
  #landed: number[] = [];

  issue(): number {
    return ++this.#issued;
  }

  erase(
    index: number
  ): void {
    this.#landed[index] = ++this.#issued;
  }

  reset(): void {
    this.#floor = ++this.#issued;
    this.#landed = [];
  }

  land(
    index: number,
    ticket: number
  ): boolean {
    if (ticket <= this.#floor || ticket <= (this.#landed[index] ?? 0)) {
      return false;
    }

    this.#landed[index] = ticket;

    return true;
  }
}
