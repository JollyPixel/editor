// Import Internal Dependencies
import {
  concat,
  hasPngSignature,
  readChunks
} from "./chunks.ts";
import {
  readHeader,
  type PngHeader
} from "./header.ts";
import { unfilterScanlines } from "./filters.ts";
import { toRGBA } from "./pixels.ts";
import { inflate } from "./zlib.ts";
import { InvalidPngError } from "./errors/InvalidPngError.ts";
import type { DecodedImage } from "../types.ts";

export async function decodePng(
  data: Uint8Array
): Promise<DecodedImage> {
  if (!hasPngSignature(data)) {
    throw new InvalidPngError("payload is not a PNG.");
  }

  let header: PngHeader | null = null;
  let entries: Uint8Array | null = null;
  let alpha: Uint8Array | null = null;
  const idat: Uint8Array[] = [];

  for (const chunk of readChunks(data)) {
    switch (chunk.type) {
      case "IHDR":
        header = readHeader(chunk.data);
        break;
      case "PLTE":
        entries = chunk.data;
        break;
      case "tRNS":
        alpha = chunk.data;
        break;
      case "IDAT":
        idat.push(chunk.data);
        break;
    }
  }

  if (header === null) {
    throw new InvalidPngError("the image has no IHDR chunk.");
  }

  const { width, height, color } = header;
  const stride = width * color.channels;
  const samples = unfilterScanlines(
    await inflate(concat(idat), height * (stride + 1)),
    width,
    height,
    color.channels
  );

  return {
    width,
    height,
    data: toRGBA(samples, color, {
      entries,
      alpha
    })
  };
}
