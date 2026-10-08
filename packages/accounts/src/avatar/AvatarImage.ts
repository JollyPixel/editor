// Import Node.js Dependencies
import { createHash } from "node:crypto";

// Import Third-party Dependencies
import sharp from "sharp";

// Import Internal Dependencies
import { InvalidAvatarError } from "./errors/InvalidAvatarError.ts";

// CONSTANTS
export const AVATAR_SIZE_PX = 128;
const kMaxInputPixels = 4_096 * 4_096;
const kWebpQuality = 85;
const kHashLength = 16;

export interface StoredAvatar {
  hash: string;
  bytes: Uint8Array;
}

export class AvatarImage implements StoredAvatar {
  static async encode(
    input: Uint8Array
  ): Promise<AvatarImage> {
    try {
      const image = sharp(input, {
        failOn: "error",
        limitInputPixels: kMaxInputPixels
      }).autoOrient();
      const { width, height } = await image.metadata();
      const upscaled = Math.min(width, height) < AVATAR_SIZE_PX;

      return new AvatarImage(
        await image
          .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, {
            fit: "cover",
            kernel: upscaled ? "nearest" : "lanczos3"
          })
          .webp({ quality: kWebpQuality })
          .toBuffer()
      );
    }
    catch (cause) {
      throw new InvalidAvatarError(
        "the avatar is not a readable image",
        { cause }
      );
    }
  }

  readonly hash: string;
  readonly bytes: Uint8Array;

  constructor(
    bytes: Uint8Array
  ) {
    this.bytes = bytes;
    this.hash = createHash("sha256")
      .update(bytes)
      .digest("hex")
      .slice(0, kHashLength);
  }
}
