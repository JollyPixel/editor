// Import Internal Dependencies
import {
  decodePng
} from "../png/decodePng.ts";
import { createCanvas2D } from "./Canvas2D.ts";
import type { DecodedImage } from "../types.ts";

// CONSTANTS
const kPngType = "image/png";
const kBytesPerPixel = 4;

function rasterFromCanvas(
  canvas: HTMLCanvasElement
): DecodedImage {
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
    data: imageData.data
  };
}

async function decodeWithImageDecoder(
  blob: Blob
): Promise<DecodedImage | null> {
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
): Promise<DecodedImage | null> {
  const width = frame.codedWidth;
  const height = frame.codedHeight;
  const options: VideoFrameCopyToOptions = {
    format: "RGBA",
    colorSpace: "srgb"
  };

  if (frame.allocationSize(options) !== width * height * kBytesPerPixel) {
    return null;
  }

  const data = new Uint8ClampedArray(
    width * height * kBytesPerPixel
  );
  await frame.copyTo(data, options);

  return {
    width,
    height,
    data
  };
}

async function decodeWithImageBitmap(
  blob: Blob
): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(blob, {
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

async function decodeWithPng(
  blob: Blob
): Promise<DecodedImage | null> {
  if (blob.type !== kPngType) {
    return null;
  }

  try {
    return await decodePng(
      new Uint8Array(await blob.arrayBuffer())
    );
  }
  catch {
    return null;
  }
}

async function decodeExact(
  blob: Blob
): Promise<DecodedImage | null> {
  return await decodeWithImageDecoder(blob) ??
    await decodeWithPng(blob);
}

export async function decodeRaster(
  blob: Blob
): Promise<DecodedImage> {
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
  imageData.data.set(decoded.data);
  context.putImageData(imageData, 0, 0);

  return canvas;
}
