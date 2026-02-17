export class PersistentIdIncrement {
  #ids = new Set<string>();

  next(): string {
    let id: string;
    do {
      id = PersistentIdIncrement.randomId();
    }
    while (this.#ids.has(id));

    this.#ids.add(id);

    return id;
  }

  has(
    id: string
  ): boolean {
    return this.#ids.has(id);
  }

  clear(): void {
    this.#ids.clear();
  }

  static randomId(): string {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}
