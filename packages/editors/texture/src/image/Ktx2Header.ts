// Import Internal Dependencies
import { TextureFileError } from "../errors/TextureFileError.ts";

// CONSTANTS
const kIdentifier = [
  0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
];
const kHeaderBytes = 48;
const kSupercompression: readonly string[] = [
  "None",
  "BasisLZ",
  "Zstandard",
  "ZLIB"
];

export class Ktx2Header {
  static parse(
    bytes: Uint8Array
  ): Ktx2Header {
    const valid = bytes.byteLength >= kHeaderBytes &&
      kIdentifier.every((byte, index) => bytes[index] === byte);
    if (!valid) {
      throw new TextureFileError("The file is not a KTX2 texture.");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, kHeaderBytes);
    const scheme = view.getUint32(44, true);

    return new Ktx2Header({
      width: view.getUint32(20, true),
      height: view.getUint32(24, true),
      levels: Math.max(1, view.getUint32(40, true)),
      compression: kSupercompression[scheme] ?? `Scheme ${scheme}`
    });
  }

  readonly width: number;
  readonly height: number;
  readonly levels: number;
  readonly compression: string;

  constructor(
    header: Pick<Ktx2Header, "width" | "height" | "levels" | "compression">
  ) {
    this.width = header.width;
    this.height = header.height;
    this.levels = header.levels;
    this.compression = header.compression;
  }
}
