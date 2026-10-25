// Import Internal Dependencies
import {
  InvalidPixelArtFileError
} from "./errors/InvalidPixelArtFileError.ts";
import {
  PIXEL_ART_FILE_VERSION,
  type PixelArtFile
} from "./types.ts";
import { encodePixelBytes } from "./pixelBytes.ts";
import { TextureBounds } from "../buffer/TextureBounds.ts";
import { isUVRegionData } from "../uv/region/validation.ts";
import { NormalMapConfig } from "../normal/NormalMapConfig.ts";
import { ColorPalette } from "../palette/ColorPalette.ts";
import { UVNetSet } from "../uv/region/UVNetSet.ts";
import type { Vec2 } from "../types.ts";

export function createPixelArtFile(
  size: Vec2,
  pixels: Uint8Array | Uint8ClampedArray = new Uint8Array(size.x * size.y * 4)
): PixelArtFile {
  if (!TextureBounds.isSize(size)) {
    throw new InvalidPixelArtFileError("size is not a pair of positive integers");
  }

  const expected = size.x * size.y * 4;
  if (pixels.length !== expected) {
    throw new InvalidPixelArtFileError(
      `pixels hold ${pixels.length} bytes, expected ${expected}`
    );
  }

  return {
    version: PIXEL_ART_FILE_VERSION,
    size: {
      x: size.x,
      y: size.y
    },
    pixels: encodePixelBytes(pixels),
    uvRegions: [],
    palette: ColorPalette.create().toJSON()
  };
}

export function parsePixelArtFile(
  value: unknown
): PixelArtFile {
  if (typeof value !== "object" || value === null) {
    throw new InvalidPixelArtFileError("payload is not an object");
  }

  const file = value as Partial<PixelArtFile>;
  if (file.version !== PIXEL_ART_FILE_VERSION) {
    throw new InvalidPixelArtFileError(
      `unsupported version ${String(file.version)}`
    );
  }
  if (!TextureBounds.isSize(file.size)) {
    throw new InvalidPixelArtFileError("size is not a pair of positive integers");
  }
  if (typeof file.pixels !== "string") {
    throw new InvalidPixelArtFileError("pixels is not a base64 string");
  }
  if (
    !Array.isArray(file.uvRegions) ||
    !file.uvRegions.every(isUVRegionData)
  ) {
    throw new InvalidPixelArtFileError("uvRegions contains invalid data");
  }

  const parsed: PixelArtFile = {
    version: PIXEL_ART_FILE_VERSION,
    size: file.size,
    pixels: file.pixels,
    uvRegions: file.uvRegions
  };
  if (file.normalMap !== undefined) {
    const normalMap = NormalMapConfig.parse(file.normalMap);
    if (normalMap === null) {
      throw new InvalidPixelArtFileError("normalMap contains invalid data");
    }
    parsed.normalMap = normalMap.toJSON();
  }
  if (file.palette !== undefined) {
    const palette = ColorPalette.parse(file.palette);
    if (palette === null) {
      throw new InvalidPixelArtFileError("palette contains invalid data");
    }
    parsed.palette = palette.toJSON();
  }
  if (file.uvNets !== undefined) {
    const uvNets = UVNetSet.parse(file.uvNets);
    if (uvNets === null) {
      throw new InvalidPixelArtFileError("uvNets contains invalid data");
    }
    parsed.uvNets = uvNets.toJSON();
  }

  return parsed;
}

export function encodePixelArtFile(
  file: PixelArtFile
): Uint8Array {
  return new TextEncoder().encode(
    JSON.stringify(file)
  );
}

export function decodePixelArtFile(
  data: Uint8Array
): PixelArtFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      new TextDecoder().decode(data)
    );
  }
  catch (error) {
    throw new InvalidPixelArtFileError(
      "payload is not JSON",
      { cause: error }
    );
  }

  return parsePixelArtFile(parsed);
}
