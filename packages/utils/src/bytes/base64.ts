// CONSTANTS
const kBinaryChunkLength = 0x8000;
const kBase64 = /^[A-Za-z0-9+/]*={0,2}$/;
const kMaxPadding = 2;

interface NativeBase64Options {
  lastChunkHandling: "strict";
}

interface NativeBase64Decoder {
  fromBase64?: (
    text: string,
    options: NativeBase64Options
  ) => Uint8Array<ArrayBuffer>;
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

export function encodeBase64Url(
  bytes: Uint8Array
): string {
  return encodeBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/[=]+$/, "");
}

export function decodeBase64(
  text: string
): Uint8Array<ArrayBuffer> | null {
  if (text.length % 4 !== 0) {
    return null;
  }

  const { fromBase64 } = Uint8Array as NativeBase64Decoder;
  if (typeof fromBase64 === "function") {
    return decodeNative(text, fromBase64);
  }

  if (!kBase64.test(text)) {
    return null;
  }

  if (typeof globalThis.Buffer === "function") {
    const decoded = globalThis.Buffer.from(text, "base64");
    const { buffer } = decoded;
    const owned = buffer instanceof ArrayBuffer &&
      decoded.byteLength === buffer.byteLength;

    return owned ? new Uint8Array(buffer) : new Uint8Array(decoded);
  }

  return Uint8Array.from(
    atob(text),
    (character) => character.charCodeAt(0)
  );
}

function decodeNative(
  text: string,
  fromBase64: NonNullable<NativeBase64Decoder["fromBase64"]>
): Uint8Array<ArrayBuffer> | null {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    bytes = fromBase64(text, { lastChunkHandling: "strict" });
  }
  catch {
    return null;
  }

  return bytes.length === unpaddedLength(text) ? bytes : null;
}

function unpaddedLength(
  text: string
): number {
  let padding = 0;
  while (
    padding < kMaxPadding &&
    text[text.length - 1 - padding] === "="
  ) {
    padding++;
  }

  return (text.length / 4 * 3) - padding;
}
