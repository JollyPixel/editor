// CONSTANTS
const kDigit = /\d/;
const kSpace = /\s/;

export const TRACK_PATH_SEPARATOR = "/";

export function nameKey(
  name: string
): string {
  return name.trim().toLowerCase();
}

export function trackPathKey(
  path: string
): string {
  return path.split(TRACK_PATH_SEPARATOR).map(nameKey).join(TRACK_PATH_SEPARATOR);
}

export function sameTrackPath(
  left: string,
  right: string
): boolean {
  return trackPathKey(left) === trackPathKey(right);
}

export function trackBlockName(
  path: string
): string {
  return path.split(TRACK_PATH_SEPARATOR).at(-1) ?? path;
}

export function freeName(
  desired: string,
  isTaken: (name: string) => boolean
): string {
  const name = desired.trim();
  if (!isTaken(name)) {
    return name;
  }

  const base = withoutTrailingNumber(name);
  let index = 2;
  while (isTaken(`${base} ${index}`)) {
    index++;
  }

  return `${base} ${index}`;
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
