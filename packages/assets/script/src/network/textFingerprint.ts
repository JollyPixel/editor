// CONSTANTS
const kFnvOffset = 0x811c9dc5;
const kFnvPrime = 0x01000193;

export function textFingerprint(
  text: string
): string {
  let hash = kFnvOffset;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), kFnvPrime);
  }

  return `${text.length}.${(hash >>> 0).toString(36)}`;
}
