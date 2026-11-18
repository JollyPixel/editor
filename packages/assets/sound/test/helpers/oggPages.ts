// CONSTANTS
const kPageHeaderBytes = 27;
const kPolynomial = 0x04c11db7;

export interface OggPageSummary {
  readonly sequence: number;
  readonly crcValid: boolean;
}

export function summarizeOggPages(
  content: Uint8Array
): OggPageSummary[] {
  const view = new DataView(content.buffer, content.byteOffset, content.byteLength);
  const pages: OggPageSummary[] = [];
  for (let offset = 0; offset < content.byteLength;) {
    const segments = content[offset + kPageHeaderBytes - 1];
    const lacing = content.subarray(offset + kPageHeaderBytes, offset + kPageHeaderBytes + segments);
    const end = offset + kPageHeaderBytes + segments + lacing.reduce((sum, size) => sum + size, 0);
    const page = content.slice(offset, end);
    const stored = view.getUint32(offset + 22, true);
    page.fill(0, 22, 26);

    pages.push({
      sequence: view.getUint32(offset + 18, true),
      crcValid: oggCrc(page) === stored
    });
    offset = end;
  }

  return pages;
}

function oggCrc(
  bytes: Uint8Array
): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 24;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x80000000) === 0 ? crc << 1 : (crc << 1) ^ kPolynomial;
    }
  }

  return crc >>> 0;
}
