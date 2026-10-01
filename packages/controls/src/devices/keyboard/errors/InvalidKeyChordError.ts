export class InvalidKeyChordError extends Error {
  readonly chord: string;

  constructor(
    chord: string
  ) {
    super(`Invalid key chord: "${chord}"`);
    this.name = "InvalidKeyChordError";
    this.chord = chord;
  }
}
