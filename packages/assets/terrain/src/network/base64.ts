// CONSTANTS
const kBinaryBatch = 0x8000;

export function encodeBase64(
  bytes: Uint8Array
): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += kBinaryBatch) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + kBinaryBatch));
  }

  return btoa(binary);
}

export function decodeBase64(
  encoded: string
): Uint8Array | null {
  let binary: string;
  try {
    binary = atob(encoded);
  }
  catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
