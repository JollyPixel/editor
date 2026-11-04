export class PaletteSelection {
  static at(
    index: number
  ): PaletteSelection {
    return new PaletteSelection(index, index);
  }

  static spanning(
    start: number,
    count: number
  ): PaletteSelection {
    return new PaletteSelection(start, start + count - 1);
  }

  readonly anchor: number;
  readonly focus: number;

  constructor(
    anchor: number,
    focus: number
  ) {
    if (!isSlot(anchor) || !isSlot(focus)) {
      throw new RangeError("Palette selection bounds must be non-negative integers");
    }

    this.anchor = anchor;
    this.focus = focus;
  }

  get start(): number {
    return Math.min(this.anchor, this.focus);
  }

  get end(): number {
    return Math.max(this.anchor, this.focus);
  }

  get count(): number {
    return this.end - this.start + 1;
  }

  get multiple(): boolean {
    return this.count > 1;
  }

  includes(
    index: number
  ): boolean {
    return index >= this.start && index <= this.end;
  }

  extendTo(
    index: number
  ): PaletteSelection {
    return new PaletteSelection(this.anchor, index);
  }

  clampTo(
    size: number
  ): PaletteSelection {
    const last = size - 1;
    if (this.anchor <= last && this.focus <= last) {
      return this;
    }

    return new PaletteSelection(
      Math.min(this.anchor, last),
      Math.min(this.focus, last)
    );
  }
}

function isSlot(
  value: number
): boolean {
  return Number.isInteger(value) && value >= 0;
}
