// CONSTANTS
const kInitialCells = 4096;

export class LightQueue {
  #cells = new Int32Array(kInitialCells * 3);
  #head = 0;
  #tail = 0;
  #x = 0;
  #y = 0;
  #z = 0;

  get x(): number {
    return this.#x;
  }

  get y(): number {
    return this.#y;
  }

  get z(): number {
    return this.#z;
  }

  push(
    x: number,
    y: number,
    z: number
  ): void {
    if (this.#tail + 3 > this.#cells.length) {
      this.#makeRoom();
    }

    const cells = this.#cells;
    cells[this.#tail] = x;
    cells[this.#tail + 1] = y;
    cells[this.#tail + 2] = z;
    this.#tail += 3;
  }

  next(): boolean {
    if (this.#head === this.#tail) {
      this.#head = 0;
      this.#tail = 0;

      return false;
    }

    const cells = this.#cells;
    this.#x = cells[this.#head];
    this.#y = cells[this.#head + 1];
    this.#z = cells[this.#head + 2];
    this.#head += 3;

    return true;
  }

  #makeRoom(): void {
    if (this.#head > this.#cells.length / 2) {
      this.#cells.copyWithin(0, this.#head, this.#tail);
    }
    else {
      const grown = new Int32Array(this.#cells.length * 2);
      grown.set(this.#cells.subarray(this.#head, this.#tail));
      this.#cells = grown;
    }
    this.#tail -= this.#head;
    this.#head = 0;
  }
}
