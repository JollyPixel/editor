export class LineRange {
  readonly first: number;
  readonly last: number;

  constructor(
    first: number,
    last: number
  ) {
    this.first = first;
    this.last = last;
  }

  intersect(
    other: LineRange
  ): LineRange {
    return new LineRange(
      Math.max(this.first, other.first),
      Math.min(this.last, other.last)
    );
  }

  equals(
    other: LineRange
  ): boolean {
    return this.first === other.first && this.last === other.last;
  }

  map<T>(
    callback: (line: number) => T
  ): T[] {
    return Array.from(this, callback);
  }

  * [Symbol.iterator](): IterableIterator<number> {
    for (let line = this.first; line <= this.last; line++) {
      yield line;
    }
  }
}
