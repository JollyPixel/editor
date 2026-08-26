// Import Third-party Dependencies
import {
  imageDataToPixels,
  pixelsToImageData
} from "@jolly-pixel/color";

// Import Internal Dependencies
import type {
  DecodedRasterImage,
  SelectionSnapshot
} from "./types.ts";
import {
  createCanvas2D
} from "../rendering/Canvas2D.ts";
import { decodePng } from "../image/decodePng.ts";

// CONSTANTS
const kPngType = "image/png";
// Canvas backing stores hold premultiplied 8-bit RGBA, so drawImage cannot
// round-trip low-alpha colors: rgba(200,100,50,3) premultiplies to (2,1,1,3)
// and comes back as (170,85,85,3). WebCodecs hands us the file's own samples
// instead, which is what a pixel-art editor needs.
const kBytesPerPixel = 4;

function renderSnapshot(
  snapshot: SelectionSnapshot
): HTMLCanvasElement {
  const { canvas, context } = createCanvas2D(
    snapshot.rect.width,
    snapshot.rect.height,
    { willReadFrequently: true }
  );

  const imageData = context.createImageData(
    canvas.width,
    canvas.height
  );
  pixelsToImageData(snapshot.pixels, imageData.data, snapshot.mask);
  context.putImageData(imageData, 0, 0);

  return canvas;
}

/**
 * Interop format for other applications. Partial alpha survives only
 * approximately, which is why JollyPixel copies also carry raw RGBA8 in their
 * own clipboard type.
 */
export async function encodeSelectionPng(
  snapshot: SelectionSnapshot
): Promise<Blob> {
  const canvas = renderSnapshot(snapshot);
  const {
    promise,
    resolve,
    reject
  } = Promise.withResolvers<Blob>();

  canvas.toBlob((blob) => {
    if (blob) {
      resolve(blob);
    }
    else {
      reject(new Error("PNG encoding failed"));
    }
  }, "image/png");

  return promise;
}

function rasterFromCanvas(
  canvas: HTMLCanvasElement
): DecodedRasterImage {
  const context = canvas.getContext("2d", {
    willReadFrequently: true
  });
  if (!context) {
    throw new Error("Canvas 2D context is unavailable");
  }

  const imageData = context.getImageData(
    0,
    0,
    canvas.width,
    canvas.height
  );

  return {
    width: canvas.width,
    height: canvas.height,
    pixels: imageDataToPixels(imageData.data)
  };
}

/**
 * Lossless path: unpremultiplied samples straight out of the codec, with no
 * ICC transform applied. Returns `null` whenever the platform or the file
 * cannot go through it, so callers fall back to the canvas decoders.
 */
async function decodeWithImageDecoder(
  blob: Blob
): Promise<DecodedRasterImage | null> {
  if (typeof ImageDecoder !== "function") {
    return null;
  }

  let decoder: ImageDecoder;
  try {
    decoder = new ImageDecoder({
      data: await blob.arrayBuffer(),
      type: blob.type,
      colorSpaceConversion: "none",
      preferAnimation: false
    });
  }
  catch {
    return null;
  }

  try {
    await decoder.completed;
    const { image } = await decoder.decode({ frameIndex: 0 });

    try {
      return copyFrameToRaster(image);
    }
    finally {
      image.close();
    }
  }
  catch {
    return null;
  }
  finally {
    decoder.close();
  }
}

async function copyFrameToRaster(
  frame: VideoFrame
): Promise<DecodedRasterImage | null> {
  const width = frame.codedWidth;
  const height = frame.codedHeight;
  const options: VideoFrameCopyToOptions = {
    format: "RGBA",
    colorSpace: "srgb"
  };

  // A padded stride would mean the buffer is not a plain RGBA8 raster; the
  // canvas fallback is simpler than unpacking one.
  if (frame.allocationSize(options) !== width * height * kBytesPerPixel) {
    return null;
  }

  const buffer = new Uint8ClampedArray(
    width * height * kBytesPerPixel
  );
  await frame.copyTo(buffer, options);

  return {
    width,
    height,
    pixels: imageDataToPixels(buffer)
  };
}

async function decodeWithImageBitmap(
  blob: Blob
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob, {
    // Closest a canvas decode gets to the file's own samples.
    premultiplyAlpha: "none",
    colorSpaceConversion: "none"
  });
  try {
    const { canvas, context } = createCanvas2D(
      bitmap.width,
      bitmap.height,
      { willReadFrequently: true }
    );
    context.drawImage(bitmap, 0, 0);

    return canvas;
  }
  finally {
    bitmap.close();
  }
}

/**
 * Last resort. `<img>` decoding always applies color management and
 * premultiplies, so colors can shift; it exists for platforms without
 * createImageBitmap.
 */
function decodeWithImage(
  blob: Blob
): Promise<HTMLCanvasElement> {
  const objectUrl = URL.createObjectURL(blob);
  const {
    promise,
    resolve,
    reject
  } = Promise.withResolvers<HTMLCanvasElement>();

  const image = new Image();
  image.onload = () => {
    try {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      const { canvas, context } = createCanvas2D(
        width,
        height,
        { willReadFrequently: true }
      );
      context.drawImage(image, 0, 0);

      resolve(canvas);
    }
    catch (error) {
      reject(error);
    }
    finally {
      URL.revokeObjectURL(objectUrl);
    }
  };
  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Raster image decoding failed"));
  };
  try {
    image.src = objectUrl;
  }
  catch (error) {
    URL.revokeObjectURL(objectUrl);
    reject(error);
  }

  return promise;
}

/**
 * Pure-JS PNG path for platforms without WebCodecs, where the canvas decoders
 * are the only other option and premultiply. Returns null for other formats
 * and for PNG features the decoder does not implement.
 */
async function decodeWithPng(
  blob: Blob
): Promise<DecodedRasterImage | null> {
  if (blob.type !== kPngType) {
    return null;
  }

  try {
    const {
      width,
      height,
      pixels
    } = await decodePng(
      new Uint8Array(await blob.arrayBuffer())
    );

    return {
      width,
      height,
      pixels: imageDataToPixels(pixels)
    };
  }
  catch {
    return null;
  }
}

/**
 * The two lossless decoders, in order of preference. Null means every exact
 * path declined and the caller must fall back to a canvas.
 */
async function decodeExact(
  blob: Blob
): Promise<DecodedRasterImage | null> {
  return await decodeWithImageDecoder(blob) ??
    await decodeWithPng(blob);
}

/**
 * Decodes to exact RGBA8, preferring WebCodecs so partial alpha and embedded
 * color profiles cannot alter the pixels.
 */
export async function decodeRasterBlob(
  blob: Blob
): Promise<DecodedRasterImage> {
  const decoded = await decodeExact(blob);
  if (decoded) {
    return decoded;
  }

  return rasterFromCanvas(
    await decodeRasterToCanvas(blob)
  );
}

async function decodeRasterToCanvas(
  blob: Blob
): Promise<HTMLCanvasElement> {
  return (
    typeof createImageBitmap === "function"
      ? decodeWithImageBitmap(blob)
      : decodeWithImage(blob)
  );
}

/**
 * Same decode as {@link decodeRasterBlob}, delivered as a canvas for callers
 * that feed one to the buffer (texture replacement). Exact samples are written
 * with putImageData rather than composited, so the WebCodecs path stays
 * lossless end to end.
 */
export async function decodeRasterCanvas(
  blob: Blob
): Promise<HTMLCanvasElement> {
  const decoded = await decodeExact(blob);
  if (!decoded) {
    return decodeRasterToCanvas(blob);
  }

  const { canvas, context } = createCanvas2D(
    decoded.width,
    decoded.height,
    { willReadFrequently: true }
  );
  const imageData = context.createImageData(
    decoded.width,
    decoded.height
  );
  pixelsToImageData(decoded.pixels, imageData.data);
  context.putImageData(imageData, 0, 0);

  return canvas;
}
