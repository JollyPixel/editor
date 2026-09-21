export async function contentHash(
  data: Uint8Array
): Promise<string> {
  const source = data.buffer instanceof ArrayBuffer ?
    new Uint8Array(data.buffer, data.byteOffset, data.byteLength) :
    Uint8Array.from(data);
  const digest = await crypto.subtle.digest("SHA-256", source);

  return Array.from(
    new Uint8Array(digest),
    (byte) => byte.toString(16).padStart(2, "0")
  ).join("");
}
