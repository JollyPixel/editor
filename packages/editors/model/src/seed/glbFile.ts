// CONSTANTS
const kGlbMagic = 0x46546C67;
const kJsonChunk = 0x4E4F534A;
const kBinChunk = 0x004E4942;
const kSpace = 0x20;

export function glbFile(
  json: object,
  bin: Uint8Array
): Uint8Array {
  const jsonBytes = padded(
    new TextEncoder().encode(JSON.stringify(json)),
    kSpace
  );
  const binBytes = padded(bin, 0);
  const binOffset = 20 + jsonBytes.byteLength;
  const length = binOffset + 8 + binBytes.byteLength;

  const file = new Uint8Array(length);
  const view = new DataView(file.buffer);
  view.setUint32(0, kGlbMagic, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, length, true);
  view.setUint32(12, jsonBytes.byteLength, true);
  view.setUint32(16, kJsonChunk, true);
  file.set(jsonBytes, 20);
  view.setUint32(binOffset, binBytes.byteLength, true);
  view.setUint32(binOffset + 4, kBinChunk, true);
  file.set(binBytes, binOffset + 8);

  return file;
}

function padded(
  bytes: Uint8Array,
  fill: number
): Uint8Array {
  const result = new Uint8Array(Math.ceil(bytes.byteLength / 4) * 4)
    .fill(fill);
  result.set(bytes);

  return result;
}
