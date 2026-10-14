// CONSTANTS
const kCombiningMarks = /\p{M}/gu;
const kAscii = /^[ -~]*$/;

export interface SearchMatch {
  start: number;
  end: number;
}

export class SearchQuery {
  static readonly EMPTY = new SearchQuery("");

  readonly text: string;
  readonly #folded: string;

  constructor(
    text: string
  ) {
    this.text = text.trim();
    this.#folded = fold(this.text);
    Object.freeze(this);
  }

  get isEmpty(): boolean {
    return this.#folded === "";
  }

  matches(
    text: string
  ): boolean {
    return this.isEmpty || fold(text).includes(this.#folded);
  }

  rangeIn(
    text: string
  ): SearchMatch | null {
    if (this.isEmpty) {
      return null;
    }

    const origins: number[] = [];
    const index = fold(text, origins).indexOf(this.#folded);
    if (index === -1) {
      return null;
    }

    return {
      start: origins[index],
      end: origins[index + this.#folded.length]
    };
  }

  equals(
    other: SearchQuery
  ): boolean {
    return this.#folded === other.#folded;
  }
}

function fold(
  text: string,
  origins?: number[]
): string {
  if (kAscii.test(text)) {
    if (origins !== undefined) {
      for (let index = 0; index <= text.length; index++) {
        origins.push(index);
      }
    }

    return text.toLowerCase();
  }

  let folded = "";
  let offset = 0;
  for (const char of text) {
    const part = char
      .normalize("NFD")
      .replace(kCombiningMarks, "")
      .toLowerCase();
    folded += part;
    for (let index = 0; index < part.length; index++) {
      origins?.push(offset);
    }
    offset += char.length;
  }
  origins?.push(offset);

  return folded;
}
