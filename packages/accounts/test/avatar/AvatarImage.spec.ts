// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import sharp from "sharp";

// Import Internal Dependencies
import {
  solidPng,
  taggedJpeg,
  twoColumnPng
} from "../helpers/avatar/images.ts";
import {
  AVATAR_SIZE_PX,
  AvatarImage
} from "#src/node.ts";
import { InvalidAvatarError } from "#src/index.ts";

// CONSTANTS
const kChannelTolerance = 24;

describe("AvatarImage.encode", () => {
  test("crops any image to a square WebP", async() => {
    const avatar = await AvatarImage.encode(await solidPng(400, 200));
    const metadata = await sharp(avatar.bytes).metadata();

    assert.equal(metadata.format, "webp");
    assert.equal(metadata.width, AVATAR_SIZE_PX);
    assert.equal(metadata.height, AVATAR_SIZE_PX);
  });

  test("strips the metadata of the upload", async() => {
    const avatar = await AvatarImage.encode(await taggedJpeg());
    const metadata = await sharp(avatar.bytes).metadata();

    assert.equal(metadata.exif, undefined);
  });

  test("keeps the pixels of a small image sharp", async() => {
    const avatar = await AvatarImage.encode(await twoColumnPng());
    const { data, info } = await sharp(avatar.bytes)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const nearEdge = (AVATAR_SIZE_PX / 2) - 3;
    const offset = ((AVATAR_SIZE_PX / 2) * info.width + nearEdge) * info.channels;

    assert.ok(data[offset] > 255 - kChannelTolerance, `red is ${data[offset]}`);
    assert.ok(data[offset + 2] < kChannelTolerance, `blue is ${data[offset + 2]}`);
  });

  test("names the same image with the same hash", async() => {
    const image = await solidPng(64, 64);

    const first = await AvatarImage.encode(image);
    const second = await AvatarImage.encode(image);

    assert.equal(first.hash, second.hash);
    assert.match(first.hash, /^[0-9a-f]{16}$/);
  });

  test("refuses bytes that are not an image", async() => {
    await assert.rejects(
      AvatarImage.encode(new TextEncoder().encode("not an image")),
      InvalidAvatarError
    );
  });
});
