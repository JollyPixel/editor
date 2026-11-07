// Import Third-party Dependencies
import {
  Ok,
  Err,
  type Result
} from "@openally/result";
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { PlaceholderCollisionError } from "./errors/PlaceholderCollisionError.ts";

// CONSTANTS
const kVersion = 1;
const kAlignment = 8;
const kU32Length = 4;
const kFixedPrefixLength = 1 + kU32Length + kU32Length;
const kPlaceholderKey = "$bytes";
const kUtf8Encoder = new TextEncoder();
const kUtf8Decoder = new TextDecoder("utf-8", { fatal: true });

export type Frame = string | Uint8Array<ArrayBuffer>;

export type ReceivedFrame = string | Uint8Array | ArrayBuffer;

export type FrameDecodeError = {
  reason: "invalid-json" | "invalid-frame";
  message: string;
};

export type JsonParser = (text: string) => unknown;

type JsonReplacer = (
  this: unknown,
  key: string,
  item: unknown
) => unknown;

export function encodeFrame(
  value: unknown
): Frame {
  const attachments: Uint8Array[] = [];
  const json = JSON.stringify(
    value,
    bytesReplacer(
      (bytes) => {
        attachments.push(bytes);

        return { [kPlaceholderKey]: attachments.length - 1 };
      },
      refusePlaceholder
    )
  );

  return attachments.length === 0 ? json : pack(json, attachments);
}

export function decodeFrame(
  frame: ReceivedFrame,
  parseJson: JsonParser = JSON.parse
): Result<unknown, FrameDecodeError> {
  if (typeof frame === "string") {
    return parseText(frame, parseJson)
      .andThen((value) => restoreAll(value, []));
  }

  const bytes = frame instanceof ArrayBuffer ?
    new Uint8Array(frame) :
    new Uint8Array(frame.buffer, frame.byteOffset, frame.byteLength);

  return unpack(bytes, parseJson);
}

export function encodedLength(
  value: unknown
): number {
  let attachmentLength = 0;
  const json = JSON.stringify(
    value,
    bytesReplacer((bytes) => {
      attachmentLength += bytes.byteLength;

      return null;
    })
  );

  return (json?.length ?? 0) + attachmentLength;
}

export function isBinaryFrame(
  value: unknown
): value is Uint8Array | ArrayBuffer {
  return value instanceof Uint8Array || value instanceof ArrayBuffer;
}

function bytesReplacer(
  replaceBytes: (bytes: Uint8Array) => unknown,
  replaceOther: (item: unknown) => unknown = (item) => item
): JsonReplacer {
  return function replacer(key, item) {
    const raw = Reflect.get(Object(this), key);

    return raw instanceof Uint8Array ? replaceBytes(raw) : replaceOther(item);
  };
}

function refusePlaceholder(
  item: unknown
): unknown {
  if (isPlaceholderShaped(item)) {
    throw new PlaceholderCollisionError(kPlaceholderKey);
  }

  return item;
}

function pack(
  json: string,
  attachments: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> {
  const header = kUtf8Encoder.encode(json);
  const prefixLength = kFixedPrefixLength + (kU32Length * attachments.length);
  const offsets: number[] = [];
  let end = prefixLength + header.byteLength;
  for (const attachment of attachments) {
    const offset = align(end);
    offsets.push(offset);
    end = offset + attachment.byteLength;
  }

  const frame = new Uint8Array(end);
  const view = new DataView(frame.buffer);
  view.setUint8(0, kVersion);
  view.setUint32(1, header.byteLength, true);
  view.setUint32(5, attachments.length, true);
  for (let index = 0; index < attachments.length; index++) {
    view.setUint32(
      kFixedPrefixLength + (kU32Length * index),
      attachments[index].byteLength,
      true
    );
    frame.set(attachments[index], offsets[index]);
  }
  frame.set(header, prefixLength);

  return frame;
}

function unpack(
  frame: Uint8Array,
  parseJson: JsonParser
): Result<unknown, FrameDecodeError> {
  if (frame.byteLength < kFixedPrefixLength) {
    return invalidFrame("frame is shorter than its prefix");
  }

  const view = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
  const version = view.getUint8(0);
  if (version !== kVersion) {
    return invalidFrame(`unsupported frame version ${version}`);
  }

  const headerLength = view.getUint32(1, true);
  const count = view.getUint32(5, true);
  const prefixLength = kFixedPrefixLength + (kU32Length * count);
  if (prefixLength + headerLength > frame.byteLength) {
    return invalidFrame("header overruns the frame");
  }

  const attachments: Uint8Array[] = [];
  let end = prefixLength + headerLength;
  for (let index = 0; index < count; index++) {
    const length = view.getUint32(kFixedPrefixLength + (kU32Length * index), true);
    const offset = align(end);
    end = offset + length;
    if (end > frame.byteLength) {
      return invalidFrame(`attachment ${index} overruns the frame`);
    }
    attachments.push(frame.subarray(offset, end));
  }
  if (end !== frame.byteLength) {
    return invalidFrame("frame length does not match its attachments");
  }

  let text: string;
  try {
    text = kUtf8Decoder.decode(frame.subarray(prefixLength, prefixLength + headerLength));
  }
  catch (error) {
    return invalidFrame(errorMessage(error));
  }

  return parseText(text, parseJson)
    .andThen((value) => restoreAll(value, attachments));
}

function restoreAll(
  value: unknown,
  attachments: readonly Uint8Array[]
): Result<unknown, FrameDecodeError> {
  try {
    const used = new Uint8Array(attachments.length);
    const restored = restore(value, attachments, used);
    const unused = used.indexOf(0);

    return unused === -1 ?
      Ok(restored) :
      invalidFrame(`attachment ${unused} has no placeholder`);
  }
  catch (error) {
    return invalidFrame(errorMessage(error));
  }
}

function restore(
  value: unknown,
  attachments: readonly Uint8Array[],
  used: Uint8Array
): unknown {
  if (typeof value !== "object" || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      value[index] = restore(value[index], attachments, used);
    }

    return value;
  }

  if (isPlaceholderShaped(value)) {
    const index: unknown = Reflect.get(value, kPlaceholderKey);
    if (
      typeof index !== "number" ||
      !Number.isInteger(index) ||
      index < 0 ||
      index >= attachments.length ||
      used[index] === 1
    ) {
      throw new RangeError(
        `placeholder ${String(index)} is not an unused attachment index`
      );
    }
    used[index] = 1;

    return attachments[index];
  }

  for (const key of Object.keys(value)) {
    Reflect.set(value, key, restore(Reflect.get(value, key), attachments, used));
  }

  return value;
}

function isPlaceholderShaped(
  value: unknown
): boolean {
  return typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.hasOwn(value, kPlaceholderKey) &&
    Object.keys(value).length === 1;
}

function parseText(
  text: string,
  parseJson: JsonParser
): Result<unknown, FrameDecodeError> {
  try {
    return Ok(parseJson(text));
  }
  catch (error) {
    return Err<FrameDecodeError>({
      reason: "invalid-json",
      message: errorMessage(error)
    });
  }
}

function invalidFrame(
  message: string
): Result<never, FrameDecodeError> {
  return Err<FrameDecodeError>({
    reason: "invalid-frame",
    message
  });
}

function align(
  offset: number
): number {
  return Math.ceil(offset / kAlignment) * kAlignment;
}
