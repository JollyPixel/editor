// CONSTANTS
const kDigit = /\d/;
const kSpace = /\s/;

export class NameSet {
  static keyOf(
    name: string
  ): string {
    return name.trim().toLowerCase();
  }

  readonly #keys = new Set<string>();

  constructor(
    names: Iterable<string> = []
  ) {
    for (const name of names) {
      this.#keys.add(NameSet.keyOf(name));
    }
  }

  has(
    name: string
  ): boolean {
    return this.#keys.has(NameSet.keyOf(name));
  }

  free(
    desired: string
  ): string {
    const name = desired.trim();
    if (!this.has(name)) {
      return name;
    }

    const base = withoutTrailingNumber(name);
    let index = 2;
    while (this.has(`${base} ${index}`)) {
      index++;
    }

    return `${base} ${index}`;
  }
}

function withoutTrailingNumber(
  name: string
): string {
  let digits = name.length;
  while (digits > 0 && kDigit.test(name[digits - 1])) {
    digits--;
  }
  let spaces = digits;
  while (spaces > 0 && kSpace.test(name[spaces - 1])) {
    spaces--;
  }

  return digits < name.length && spaces < digits ? name.slice(0, spaces) : name;
}
