export class Timecode {
  static readonly zero = new Timecode(0);

  #tenths: number;

  constructor(
    seconds: number
  ) {
    this.#tenths = Math.round(seconds * 10);
  }

  toString(): string {
    const minutes = Math.floor(this.#tenths / 600);
    const rest = (
      this.#tenths % 600 / 10
    ).toFixed(1).padStart(4, "0");

    return `${minutes}:${rest}`;
  }
}
