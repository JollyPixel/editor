export type ScrollbackKind = "echo" | "info" | "error";

export interface ScrollbackEntry {
  readonly id: number;
  readonly kind: ScrollbackKind;
  readonly text: string;
  readonly pending: boolean;
}

export class Scrollback {
  static readonly DEFAULT_CAPACITY = 500;

  readonly capacity: number;

  #entries: ScrollbackEntry[] = [];
  #nextId = 1;

  constructor(
    capacity = Scrollback.DEFAULT_CAPACITY
  ) {
    this.capacity = capacity;
  }

  get entries(): readonly ScrollbackEntry[] {
    return this.#entries.slice();
  }

  append(
    kind: ScrollbackKind,
    text: string
  ): ScrollbackEntry {
    const entry: ScrollbackEntry = {
      id: this.#nextId++,
      kind,
      text,
      pending: false
    };
    this.#entries.push(entry);
    if (this.#entries.length > this.capacity) {
      this.#entries.splice(0, this.#entries.length - this.capacity);
    }

    return entry;
  }

  updatePending(
    id: number,
    pending: boolean
  ): boolean {
    const index = this.#entries.findIndex((entry) => entry.id === id);
    if (index === -1 || this.#entries[index].pending === pending) {
      return false;
    }
    this.#entries[index] = {
      ...this.#entries[index],
      pending
    };

    return true;
  }

  clear(): void {
    this.#entries = [];
  }
}
