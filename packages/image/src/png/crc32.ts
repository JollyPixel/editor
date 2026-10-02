// CONSTANTS
const kPolynomial = 0xEDB88320;
const kSlices = 8;
const kTable = buildTable();

function buildTable(): Int32Array {
  const table = new Int32Array(256 * kSlices);

  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? kPolynomial ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value;
  }
  for (let index = 256; index < table.length; index++) {
    const previous = table[index - 256];
    table[index] = table[previous & 0xFF] ^ (previous >>> 8);
  }

  return table;
}

export function crc32(
  bytes: Uint8Array
): number {
  let crc = -1;
  let index = 0;

  for (const end = bytes.length - (kSlices - 1); index < end; index += 8) {
    crc ^= bytes[index] |
      (bytes[index + 1] << 8) |
      (bytes[index + 2] << 16) |
      (bytes[index + 3] << 24);
    crc = kTable[1792 + (crc & 0xFF)] ^
      kTable[1536 + ((crc >>> 8) & 0xFF)] ^
      kTable[1280 + ((crc >>> 16) & 0xFF)] ^
      kTable[1024 + (crc >>> 24)] ^
      kTable[768 + bytes[index + 4]] ^
      kTable[512 + bytes[index + 5]] ^
      kTable[256 + bytes[index + 6]] ^
      kTable[bytes[index + 7]];
  }
  for (; index < bytes.length; index++) {
    crc = kTable[(crc ^ bytes[index]) & 0xFF] ^ (crc >>> 8);
  }

  return ~crc >>> 0;
}
