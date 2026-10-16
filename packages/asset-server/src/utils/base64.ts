// CONSTANTS
const kBinaryChunkLength = 0x8000;

interface NativeBase64Decoder {
  fromBase64?: (text: string) => Uint8Array<ArrayBuffer>;
}

interface NativeBase64Encoder {
  toBase64?: () => string;
}

export function encodeBase64(
  bytes: Uint8Array
): string {
  const { toBase64 } = bytes as NativeBase64Encoder;
  if (typeof toBase64 === "function") {
    return toBase64.call(bytes);
  }

  if (typeof globalThis.Buffer === "function") {
    return globalThis.Buffer
      .from(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      .toString("base64");
  }

  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += kBinaryChunkLength) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + kBinaryChunkLength)
    );
  }

  return btoa(binary);
}

export function decodeBase64(
  text: string
): Uint8Array<ArrayBuffer> {
  const { fromBase64 } = Uint8Array as NativeBase64Decoder;
  if (typeof fromBase64 === "function") {
    return fromBase64(text);
  }

  if (typeof globalThis.Buffer === "function") {
    const decoded = globalThis.Buffer.from(text, "base64");
    const { buffer } = decoded;
    const owned = buffer instanceof ArrayBuffer &&
      decoded.byteLength === buffer.byteLength;

    return owned ? new Uint8Array(buffer) : new Uint8Array(decoded);
  }

  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
