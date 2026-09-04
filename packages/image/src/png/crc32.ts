// CONSTANTS
const kPolynomial = 0xEDB88320;
const kTable = buildTable();

function buildTable(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index++) {
    let value = index;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? kPolynomial ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}

export function crc32(
  ...parts: readonly Uint8Array[]
): number {
  let crc = 0xFFFFFFFF;

  for (const part of parts) {
    for (let index = 0; index < part.length; index++) {
      crc = kTable[(crc ^ part[index]) & 0xFF] ^ (crc >>> 8);
    }
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}
