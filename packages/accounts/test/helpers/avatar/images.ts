// Import Third-party Dependencies
import sharp, { type Sharp } from "sharp";

export function solidPng(
  width: number,
  height: number
): Promise<Uint8Array<ArrayBuffer>> {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "#ff0000"
    }
  });

  return encode(image.png());
}

export function taggedJpeg(): Promise<Uint8Array<ArrayBuffer>> {
  const image = sharp({
    create: {
      width: 256,
      height: 256,
      channels: 3,
      background: "#00ff00"
    }
  });

  return encode(
    image
      .withExif({
        IFD0: {
          Copyright: "Alice"
        }
      })
      .jpeg()
  );
}

export function twoColumnPng(): Promise<Uint8Array<ArrayBuffer>> {
  const pixels = Buffer.from([
    255, 0, 0,
    0, 0, 255
  ]);
  const image = sharp(pixels, {
    raw: {
      width: 2,
      height: 1,
      channels: 3
    }
  });

  return encode(image.png());
}

async function encode(
  image: Sharp
): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await image.toBuffer());
}
