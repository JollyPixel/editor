// Import Node.js Dependencies
import { Buffer } from "node:buffer";
import { deflateSync } from "node:zlib";

// CONSTANTS
const kSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

function chunk(
  type: string,
  data: Buffer
): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);

  return Buffer.concat([
    length,
    Buffer.from(type, "ascii"),
    data,
    Buffer.alloc(4)
  ]);
}

export function opaquePng(
  width: number,
  height: number
): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  const stride = (width * 4) + 1;
  const scanlines = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      scanlines[(y * stride) + 1 + (x * 4) + 3] = 255;
    }
  }

  return new Uint8Array(Buffer.concat([
    kSignature,
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(scanlines)),
    chunk("IEND", Buffer.alloc(0))
  ]));
}
