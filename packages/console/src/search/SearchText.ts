export class SearchText {
  readonly text: string;
  readonly lowered: string;
  readonly letters: number;

  #starts: Uint8Array | null = null;

  constructor(
    text: string
  ) {
    this.text = text;
    this.lowered = text.toLowerCase();
    this.letters = letterSet(this.lowered);
  }

  get starts(): Uint8Array {
    this.#starts ??= wordStarts(this.text);

    return this.#starts;
  }

  lacks(
    query: SearchText
  ): number {
    return bitCount(query.letters & ~this.letters);
  }
}

function letterSet(
  lowered: string
): number {
  let letters = 0;
  for (let index = 0; index < lowered.length; index++) {
    letters |= 1 << letterBit(lowered.charCodeAt(index));
  }

  return letters;
}

function letterBit(
  code: number
): number {
  if (code >= 97 && code <= 122) {
    return code - 97;
  }

  return code >= 48 && code <= 57 ? 26 + ((code - 48) % 5) : 31;
}

function bitCount(
  value: number
): number {
  let bits = value - ((value >>> 1) & 0x55555555);
  bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333);

  return Math.imul((bits + (bits >>> 4)) & 0x0F0F0F0F, 0x01010101) >>> 24;
}

function wordStarts(
  text: string
): Uint8Array {
  const starts = new Uint8Array(text.length);
  let previous = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    const word = isWordChar(code);
    starts[index] = Number(
      word && (!isWordChar(previous) || (isUpper(code) && !isUpper(previous)))
    );
    previous = code;
  }

  return starts;
}

function isWordChar(
  code: number
): boolean {
  return (code >= 97 && code <= 122) ||
    isUpper(code) ||
    (code >= 48 && code <= 57);
}

function isUpper(
  code: number
): boolean {
  return code >= 65 && code <= 90;
}
