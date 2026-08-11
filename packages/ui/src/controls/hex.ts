// CONSTANTS
const kFullHex = /^#?([0-9a-f]{6})$/i;
const kShortHex = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;

/**
 * Normalizes three- or six-digit hexadecimal color input.
 */
export function normalizeHex(
  input: string
): string | null {
  const text = input.trim();

  const full = kFullHex.exec(text);
  if (full !== null) {
    return `#${full[1].toLowerCase()}`;
  }

  const short = kShortHex.exec(text);
  if (short !== null) {
    const [, r, g, b] = short;

    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }

  return null;
}
