export class Volume {
  static readonly default = new Volume(0.5);

  static percent(
    percent: number
  ): Volume {
    return new Volume(percent / 100);
  }

  readonly level: number;

  constructor(
    level: number
  ) {
    this.level = Math.min(1, Math.max(0, level));
  }

  gain(): number {
    return this.level * this.level;
  }

  toPercent(): number {
    return Math.round(this.level * 100);
  }

  equals(
    other: Volume
  ): boolean {
    return this.level === other.level;
  }
}
