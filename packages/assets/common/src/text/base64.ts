// CONSTANTS
const kBinaryBatch = 0x8000;
const kBase64 = /^[A-Za-z0-9+/]*={0,2}$/;

export function encodeBase64(
  bytes: Uint8Array
): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += kBinaryBatch) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + kBinaryBatch)
    );
  }

  return btoa(binary);
}

export function decodeBase64(
  encoded: string
): Uint8Array | null {
  if (encoded.length % 4 !== 0 || !kBase64.test(encoded)) {
    return null;
  }

  return Uint8Array.from(
    atob(encoded),
    (character) => character.charCodeAt(0)
  );
}
