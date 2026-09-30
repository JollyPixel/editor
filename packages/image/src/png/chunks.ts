// Import Internal Dependencies
import { crc32 } from "./crc32.ts";

// CONSTANTS
const kSignature = new Uint8Array([
  0x89,
  0x50,
  0x4E,
  0x47,
  0x0D,
  0x0A,
  0x1A,
  0x0A
]);
const kLengthSize = 4;
const kTypeSize = 4;
const kCrcSize = 4;
const kEndType = "IEND";

export interface PngChunk {
  readonly type: string;
  readonly data: Uint8Array;
}

export function hasPngSignature(
  png: Uint8Array
): boolean {
  return kSignature.every((byte, index) => png[index] === byte);
}

export function* readChunks(
  png: Uint8Array
): IterableIterator<PngChunk> {
  const view = new DataView(
    png.buffer,
    png.byteOffset,
    png.byteLength
  );

  let offset = kSignature.length;
  while (offset + kLengthSize + kTypeSize <= png.length) {
    const length = view.getUint32(offset);
    const start = offset + kLengthSize + kTypeSize;
    const type = String.fromCharCode(
      ...png.subarray(offset + kLengthSize, start)
    );
    if (type === kEndType) {
      return;
    }

    yield {
      type,
      data: png.subarray(start, start + length)
    };
    offset = start + length + kCrcSize;
  }
}

export function writePng(
  chunks: readonly PngChunk[]
): Uint8Array<ArrayBuffer> {
  return concat([
    kSignature,
    ...chunks.map(writeChunk),
    writeChunk({
      type: kEndType,
      data: new Uint8Array(0)
    })
  ]);
}

function writeChunk(
  chunk: PngChunk
): Uint8Array {
  const { type, data } = chunk;
  const out = new Uint8Array(
    kLengthSize + kTypeSize + data.length + kCrcSize
  );
  const view = new DataView(out.buffer);
  const crcOffset = kLengthSize + kTypeSize + data.length;

  view.setUint32(0, data.length);
  for (let index = 0; index < kTypeSize; index++) {
    out[kLengthSize + index] = type.charCodeAt(index);
  }
  out.set(data, kLengthSize + kTypeSize);
  view.setUint32(
    crcOffset,
    crc32(out.subarray(kLengthSize, crcOffset))
  );

  return out;
}

export function concat(
  parts: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const part of parts) {
    total += part.length;
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }

  return out;
}
