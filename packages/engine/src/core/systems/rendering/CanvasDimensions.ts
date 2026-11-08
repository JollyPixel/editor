export class CanvasDimensions {
  static readonly empty = new CanvasDimensions(0, 0);

  readonly width: number;
  readonly height: number;

  constructor(
    width: number,
    height: number
  ) {
    this.width = Math.max(0, Math.round(width));
    this.height = Math.max(0, Math.round(height));
  }

  get isEmpty(): boolean {
    return this.width === 0 || this.height === 0;
  }

  get aspect(): number {
    return this.width / Math.max(this.height, 1);
  }

  equals(
    other: CanvasDimensions
  ): boolean {
    return this.width === other.width && this.height === other.height;
  }
}
