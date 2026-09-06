// Import Internal Dependencies
import type {
  RGBA8,
  Vec2
} from "../types.ts";
import type {
  PixelNetworkCommand
} from "./types.ts";
import {
  isUVRegionData,
  isUVSlot,
  isUVTextureRect
} from "../uv/validation.ts";

export const PIXEL_NETWORK_ACTIONS = [
  "stroke",
  "resized",
  "texture-replaced",
  "global-fill",
  "select-edit",
  "uv-region-created",
  "uv-region-deleted",
  "uv-region-moved",
  "uv-region-state-changed"
] as const;

type PixelNetworkAction = PixelNetworkCommand["action"];

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(
  value: unknown
): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(
  value: unknown
): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isVec2(
  value: unknown
): value is Vec2 {
  return isRecord(value) &&
    isInteger(value.x) &&
    isInteger(value.y);
}

function isSize(
  value: unknown
): value is Vec2 {
  return isVec2(value) && value.x > 0 && value.y > 0;
}

function isRGBA(
  value: unknown
): value is RGBA8 {
  return isRecord(value) &&
    isFiniteNumber(value.r) &&
    isFiniteNumber(value.g) &&
    isFiniteNumber(value.b) &&
    isFiniteNumber(value.a);
}

export function isPixelNetworkAction(
  value: unknown
): value is PixelNetworkAction {
  return typeof value === "string" &&
    PIXEL_NETWORK_ACTIONS.some((action) => action === value);
}

export function isPixelNetworkCommand(
  value: unknown
): value is PixelNetworkCommand {
  if (
    !isRecord(value) ||
    !isPixelNetworkAction(value.action) ||
    typeof value.clientId !== "string" ||
    !isInteger(value.seq) ||
    value.seq < 0 ||
    !isFiniteNumber(value.timestamp) ||
    !isRecord(value.metadata)
  ) {
    return false;
  }

  const metadata = value.metadata;
  switch (value.action) {
    case "stroke":
      return isRGBA(metadata.color) &&
        Array.isArray(metadata.positions) &&
        metadata.positions.every(isVec2);
    case "resized":
      return isSize(metadata.size);
    case "texture-replaced":
      return isSize(metadata.size) &&
        typeof metadata.pixels === "string";
    case "global-fill":
      return isRGBA(metadata.fromColor) &&
        isRGBA(metadata.toColor);
    case "select-edit":
      return Array.isArray(metadata.positions) &&
        metadata.positions.every(isVec2) &&
        Array.isArray(metadata.colors) &&
        metadata.colors.every(isRGBA) &&
        metadata.positions.length === metadata.colors.length;
    case "uv-region-created":
    case "uv-region-state-changed":
      return isUVRegionData(metadata.region);
    case "uv-region-deleted":
      return typeof metadata.id === "string";
    case "uv-region-moved":
      return typeof metadata.id === "string" &&
        (metadata.face === null || isUVSlot(metadata.face)) &&
        isUVTextureRect(metadata.rect);
    default:
      return false;
  }
}
