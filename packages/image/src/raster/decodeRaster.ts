// Import Internal Dependencies
import { decodePng } from "../png/decodePng.ts";
import {
  canvasFromRaster,
  createCanvas2D,
  rasterFromCanvas,
  type Canvas2D
} from "./Canvas2D.ts";
import type { DecodedImage } from "../types.ts";

// CONSTANTS
const kPngType = "image/png";
const kBytesPerPixel = 4;

export async function decodeRaster(
  blob: Blob
): Promise<DecodedImage> {
  return await decodeExact(blob) ??
    rasterFromCanvas(await decodeWithImageBitmap(blob));
}

export async function decodeRasterCanvas(
  blob: Blob
): Promise<HTMLCanvasElement> {
  const decoded = await decodeExact(blob);
  const { canvas } = decoded === null ?
    await decodeWithImageBitmap(blob) :
    canvasFromRaster(decoded);

  return canvas;
}

async function decodeExact(
  blob: Blob
): Promise<DecodedImage | null> {
  const bytes = new Uint8Array(await blob.arrayBuffer());

  return await decodeWithImageDecoder(bytes, blob.type) ??
    await decodeWithPng(bytes, blob.type);
}

async function decodeWithImageDecoder(
  data: Uint8Array,
  type: string
): Promise<DecodedImage | null> {
  if (typeof ImageDecoder !== "function") {
    return null;
  }

  let decoder: ImageDecoder | undefined;
  try {
    decoder = new ImageDecoder({
      data,
      type,
      colorSpaceConversion: "none",
      preferAnimation: false
    });
    await decoder.completed;
    const { image } = await decoder.decode({ frameIndex: 0 });

    try {
      return await copyFrameToRaster(image);
    }
    finally {
      image.close();
    }
  }
  catch {
    return null;
  }
  finally {
    decoder?.close();
  }
}

async function copyFrameToRaster(
  frame: VideoFrame
): Promise<DecodedImage | null> {
  const width = frame.codedWidth;
  const height = frame.codedHeight;
  const size = width * height * kBytesPerPixel;
  const options: VideoFrameCopyToOptions = {
    format: "RGBA",
    colorSpace: "srgb"
  };

  if (frame.allocationSize(options) !== size) {
    return null;
  }

  const data = new Uint8ClampedArray(size);
  await frame.copyTo(data, options);

  return {
    width,
    height,
    data
  };
}

async function decodeWithPng(
  data: Uint8Array,
  type: string
): Promise<DecodedImage | null> {
  if (type !== kPngType) {
    return null;
  }

  try {
    return await decodePng(data);
  }
  catch {
    return null;
  }
}

async function decodeWithImageBitmap(
  blob: Blob
): Promise<Canvas2D> {
  const bitmap = await createImageBitmap(blob, {
    premultiplyAlpha: "none",
    colorSpaceConversion: "none"
  });

  try {
    const canvas2D = createCanvas2D(bitmap.width, bitmap.height);
    canvas2D.context.drawImage(bitmap, 0, 0);

    return canvas2D;
  }
  finally {
    bitmap.close();
  }
}
