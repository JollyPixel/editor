// CONSTANTS
const kMaxVersions = 512;

export class ReplayBasis {
  #versions = new Map<number, number>();

  learn(
    timestamp: number,
    version: number | undefined
  ): void {
    if (version === undefined) {
      return;
    }

    this.#versions.delete(timestamp);
    this.#versions.set(timestamp, version);
    if (this.#versions.size > kMaxVersions) {
      this.#versions.delete(this.#versions.keys().next().value!);
    }
  }

  of(
    originTimestamp: number | undefined
  ): number | undefined {
    if (originTimestamp === undefined) {
      return undefined;
    }

    return this.#versions.get(originTimestamp) ?? 0;
  }
}
