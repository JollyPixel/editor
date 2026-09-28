// Import Internal Dependencies
import { InvalidVoxelWorldError } from "./errors/InvalidVoxelWorldError.ts";
import { parseVoxelWorld } from "./json/parseVoxelWorld.ts";
import type { VoxelWorldJSON } from "./types.ts";

// CONSTANTS
const kOpenBrace = 0x7B;
const kByteOrderMark = [0xEF, 0xBB, 0xBF];
const kWhitespace = new Set([0x20, 0x09, 0x0A, 0x0D]);

export function encodeVoxelWorld(
  document: VoxelWorldJSON
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(document)
  );
}

export function decodeVoxelWorld(
  data: Uint8Array
): VoxelWorldJSON {
  if (data[firstSignificantByte(data)] !== kOpenBrace) {
    throw new InvalidVoxelWorldError("payload is not a known format");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(data)
    );
  }
  catch (error) {
    throw new InvalidVoxelWorldError(
      "payload is not JSON",
      { cause: error }
    );
  }

  return parseVoxelWorld(parsed);
}

function firstSignificantByte(
  data: Uint8Array
): number {
  let offset = kByteOrderMark.every((byte, i) => data[i] === byte) ?
    kByteOrderMark.length :
    0;
  while (offset < data.length && kWhitespace.has(data[offset])) {
    offset++;
  }

  return offset;
}
