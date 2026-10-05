// Import Third-party Dependencies
import {
  SelectionPresence,
  type RGBA8,
  type SelectionPresenceData,
  type SelectionRect
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { isSelectionRect } from "./presenceGuards.ts";
import type { SelectionGhostPayload } from "../types.ts";

function encodeBytes(
  bytes: Uint8Array
): string {
  const chunks: string[] = [];
  for (let index = 0; index < bytes.length; index += 8192) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(index, index + 8192))
    );
  }

  return btoa(chunks.join(""));
}

function decodeBytes(
  value: unknown,
  length: number
): Uint8Array | undefined {
  if (typeof value !== "string" ||
    value.length !== Math.ceil(length / 3) * 4 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) {
    return undefined;
  }
  try {
    const binary = atob(value);
    if (binary.length !== length) {
      return undefined;
    }

    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }
  catch {
    return undefined;
  }
}

function validRect(
  value: unknown,
  maxPixels: number
): value is SelectionRect {
  return isSelectionRect(value) &&
    Number.isSafeInteger(value.x) && Number.isSafeInteger(value.y) &&
    Number.isSafeInteger(value.width) && Number.isSafeInteger(value.height) &&
    value.width > 0 && value.height > 0 &&
    Number.isSafeInteger(value.width * value.height) &&
    value.width * value.height <= maxPixels &&
    Number.isSafeInteger(value.x + value.width) &&
    Number.isSafeInteger(value.y + value.height);
}

function encodeMask(
  mask: readonly boolean[]
): string {
  if (mask.every(Boolean)) {
    return "full";
  }
  const bytes = new Uint8Array(Math.ceil(mask.length / 8));
  for (let index = 0; index < mask.length; index++) {
    if (mask[index]) {
      bytes[index >> 3] |= 1 << (index & 7);
    }
  }

  return encodeBytes(bytes);
}

function decodeMask(
  value: unknown,
  length: number
): boolean[] | undefined {
  if (value === "full") {
    return new Array<boolean>(length).fill(true);
  }
  const bytes = decodeBytes(value, Math.ceil(length / 8));
  if (bytes === undefined) {
    return undefined;
  }
  const mask = Array.from({ length }, (_, index) => (
    (bytes[index >> 3] & (1 << (index & 7))) !== 0
  ));

  return mask.some(Boolean) ? mask : undefined;
}

export function encodeSelectionPresence(
  state: SelectionPresenceData | null
): SelectionGhostPayload | null {
  if (state === null || !("mask" in state)) {
    return state;
  }
  const mask = encodeMask(state.mask);
  if (state.phase === "selected") {
    return { ...state, mask };
  }
  const bytes = new Uint8Array(state.pixels.length * 4);
  for (let index = 0; index < state.pixels.length; index++) {
    const { r, g, b, a } = state.pixels[index];
    bytes.set([r, g, b, a], index * 4);
  }

  return { ...state, mask, pixels: encodeBytes(bytes) };
}

export function decodeSelectionPresence(
  value: unknown,
  maxPixels: number
): SelectionPresenceData | undefined {
  if (typeof value !== "object" || value === null || !("phase" in value)) {
    return undefined;
  }
  if (value.phase === "creating" || value.phase === "resizing") {
    return "rect" in value && validRect(value.rect, Infinity) ?
      SelectionPresence.parse(value)?.toJSON() : undefined;
  }
  if (value.phase === "selected") {
    if (!("rect" in value) || !("mask" in value) ||
      !validRect(value.rect, maxPixels)) {
      return undefined;
    }
    const mask = decodeMask(value.mask, value.rect.width * value.rect.height);

    return mask === undefined ? undefined : SelectionPresence.parse({
      phase: "selected",
      rect: value.rect,
      mask
    })?.toJSON();
  }
  if ((value.phase !== "moving" && value.phase !== "floating") ||
    !("sourceRect" in value) || !("liveRect" in value) ||
    !("mask" in value) || !("pixels" in value) ||
    !("eraseColor" in value) || !("blankSource" in value) ||
    !validRect(value.sourceRect, maxPixels) ||
    !validRect(value.liveRect, maxPixels) ||
    value.sourceRect.width !== value.liveRect.width ||
    value.sourceRect.height !== value.liveRect.height ||
    typeof value.blankSource !== "boolean" ||
    (value.phase === "floating" && value.blankSource)) {
    return undefined;
  }
  const length = value.liveRect.width * value.liveRect.height;
  const mask = decodeMask(value.mask, length);
  const bytes = decodeBytes(value.pixels, length * 4);
  if (mask === undefined || bytes === undefined) {
    return undefined;
  }
  const pixels: RGBA8[] = Array.from({ length }, (_, index) => {
    return {
      r: bytes[index * 4],
      g: bytes[(index * 4) + 1],
      b: bytes[(index * 4) + 2],
      a: bytes[(index * 4) + 3]
    };
  });

  return SelectionPresence.parse({
    phase: value.phase,
    sourceRect: { ...value.sourceRect },
    liveRect: { ...value.liveRect },
    mask,
    pixels,
    eraseColor: value.eraseColor,
    blankSource: value.blankSource
  })?.toJSON();
}
