export class CornerRadii {
  static readonly SQUARE = new CornerRadii(0, 0, 0, 0);

  static read(
    element: Element
  ): CornerRadii {
    const style = getComputedStyle(element);

    return new CornerRadii(
      Number.parseFloat(style.borderTopLeftRadius) || 0,
      Number.parseFloat(style.borderTopRightRadius) || 0,
      Number.parseFloat(style.borderBottomRightRadius) || 0,
      Number.parseFloat(style.borderBottomLeftRadius) || 0
    );
  }

  readonly topLeft: number;
  readonly topRight: number;
  readonly bottomRight: number;
  readonly bottomLeft: number;

  constructor(
    topLeft: number,
    topRight: number,
    bottomRight: number,
    bottomLeft: number
  ) {
    this.topLeft = topLeft;
    this.topRight = topRight;
    this.bottomRight = bottomRight;
    this.bottomLeft = bottomLeft;
  }

  grow(
    by: number
  ): CornerRadii {
    return new CornerRadii(
      this.topLeft + by,
      this.topRight + by,
      this.bottomRight + by,
      this.bottomLeft + by
    );
  }

  clamp(
    limit: number
  ): CornerRadii {
    return new CornerRadii(
      Math.min(this.topLeft, limit),
      Math.min(this.topRight, limit),
      Math.min(this.bottomRight, limit),
      Math.min(this.bottomLeft, limit)
    );
  }

  equals(
    other: CornerRadii
  ): boolean {
    return other.topLeft === this.topLeft &&
      other.topRight === this.topRight &&
      other.bottomRight === this.bottomRight &&
      other.bottomLeft === this.bottomLeft;
  }

  toBorderRadius(): string {
    return `${this.topLeft}px ${this.topRight}px ` +
      `${this.bottomRight}px ${this.bottomLeft}px`;
  }
}
