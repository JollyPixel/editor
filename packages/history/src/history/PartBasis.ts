export class PartBasis {
  #inFlight = new Set<object>();
  #version = 0;

  get pending(): boolean {
    return this.#inFlight.size > 0;
  }

  get version(): number {
    return this.#version;
  }

  expect(
    change: object
  ): void {
    this.#inFlight.add(change);
  }

  confirm(
    change: object,
    version: number | undefined
  ): void {
    if (this.#inFlight.delete(change) && version !== undefined) {
      this.#version = Math.max(this.#version, version);
    }
  }

  refuse(
    change: object
  ): boolean {
    return this.#inFlight.delete(change);
  }

  drop(): void {
    this.#inFlight.clear();
  }
}
