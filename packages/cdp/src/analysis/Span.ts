export class Span {
  readonly name: string;
  readonly category: string;
  readonly start: number;
  readonly duration: number;

  constructor(
    name: string,
    category: string,
    start: number,
    duration: number
  ) {
    this.name = name;
    this.category = category;
    this.start = start;
    this.duration = duration;
  }

  get end(): number {
    return this.start + this.duration;
  }

  contains(
    other: Span
  ): boolean {
    return other.start >= this.start && other.end <= this.end;
  }

  overlap(
    other: Span
  ): number {
    return Math.max(
      0,
      Math.min(this.end, other.end) - Math.max(this.start, other.start)
    );
  }
}
