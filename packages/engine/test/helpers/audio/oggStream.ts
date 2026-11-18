// CONSTANTS
const kMaxSegments = 255;
const kEncoder = new TextEncoder();

export function commentPacket(
  magic: string,
  comments: readonly string[],
  vendor = "test"
): Uint8Array {
  const parts = [
    kEncoder.encode(magic),
    u32(vendor.length),
    kEncoder.encode(vendor),
    u32(comments.length),
    ...comments.flatMap((comment) => {
      const bytes = kEncoder.encode(comment);

      return [u32(bytes.byteLength), bytes];
    })
  ];

  return concat(parts);
}

export function oggStream(
  packets: readonly Uint8Array[]
): Uint8Array {
  const pages: Uint8Array[] = [];
  for (const packet of packets) {
    const lacing: number[] = [];
    for (let left = packet.byteLength; ; left -= 255) {
      lacing.push(Math.min(left, 255));
      if (left < 255) {
        break;
      }
    }

    let offset = 0;
    for (let start = 0; start < lacing.length; start += kMaxSegments) {
      const segments = lacing.slice(start, start + kMaxSegments);
      const size = segments.reduce((sum, value) => sum + value, 0);
      const header = new Uint8Array(27 + segments.length);
      header.set([0x4f, 0x67, 0x67, 0x53]);
      header[26] = segments.length;
      header.set(segments, 27);
      pages.push(header, packet.subarray(offset, offset + size));
      offset += size;
    }
  }

  return concat(pages);
}

function u32(
  value: number
): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, true);

  return bytes;
}

function concat(
  parts: readonly Uint8Array[]
): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }

  return bytes;
}
