export class InputHistory {
  static readonly DEFAULT_CAPACITY = 100;

  readonly capacity: number;

  #entries: string[] = [];
  #cursor = 0;
  #draft = "";

  constructor(
    capacity = InputHistory.DEFAULT_CAPACITY
  ) {
    this.capacity = capacity;
  }

  get entries(): readonly string[] {
    return this.#entries.slice();
  }

  push(
    line: string
  ): void {
    if (line.trim() !== "" && this.#entries.at(-1) !== line) {
      this.#entries.push(line);
      if (this.#entries.length > this.capacity) {
        this.#entries.splice(0, this.#entries.length - this.capacity);
      }
    }
    this.#cursor = this.#entries.length;
    this.#draft = "";
  }

  previous(
    current: string
  ): string | null {
    if (this.#cursor === 0) {
      return null;
    }
    if (this.#cursor === this.#entries.length) {
      this.#draft = current;
    }
    this.#cursor--;

    return this.#entries[this.#cursor];
  }

  next(): string | null {
    if (this.#cursor >= this.#entries.length) {
      return null;
    }
    this.#cursor++;

    return this.#cursor === this.#entries.length ?
      this.#draft :
      this.#entries[this.#cursor];
  }
}
