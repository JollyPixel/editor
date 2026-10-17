// CONSTANTS
const kHexBytes = Array.from(
  { length: 256 },
  (_, byte) => byte.toString(16).padStart(2, "0")
);

export async function contentHash(
  data: Uint8Array
): Promise<string> {
  const source = data.buffer instanceof ArrayBuffer ?
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength) :
    Uint8Array.from(data);
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", source)
  );

  let hex = "";
  for (const byte of digest) {
    hex += kHexBytes[byte];
  }

  return hex;
}
