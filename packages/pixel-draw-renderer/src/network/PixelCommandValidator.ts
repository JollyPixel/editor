// Import Internal Dependencies
import type {
  RGBA,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  PixelNetworkCommand
} from "./types.ts";
import type {
  UVFace,
  UVGeometry,
  UVRegionData,
  UVTriangleCorner
} from "../uv/UVRegion.ts";

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

function isRect(
  value: unknown
): value is SelectionRect {
  return isRecord(value) &&
    isInteger(value.x) &&
    isInteger(value.y) &&
    isInteger(value.width) &&
    isInteger(value.height) &&
    value.width > 0 &&
    value.height > 0;
}

function isRGBA(
  value: unknown
): value is RGBA {
  return isRecord(value) &&
    isFiniteNumber(value.r) &&
    isFiniteNumber(value.g) &&
    isFiniteNumber(value.b) &&
    isFiniteNumber(value.a);
}

function isUVFace(
  value: unknown
): value is UVFace {
  return value === "front" ||
    value === "back" ||
    value === "left" ||
    value === "right" ||
    value === "top" ||
    value === "bottom";
}

function isUVTriangleCorner(
  value: unknown
): value is UVTriangleCorner {
  return value === "top-left" ||
    value === "top-right" ||
    value === "bottom-left" ||
    value === "bottom-right";
}

function isUVGeometry(
  value: unknown
): value is UVGeometry {
  if (!isRecord(value) || !("shape" in value)) {
    return isRect(value);
  }

  return value.shape === "triangle" &&
    isUVTriangleCorner(value.corner) &&
    isRect(value.rect);
}

function isUVFaces(
  value: unknown
): value is Record<UVFace, UVGeometry> {
  return isRecord(value) &&
    isUVGeometry(value.front) &&
    isUVGeometry(value.back) &&
    isUVGeometry(value.left) &&
    isUVGeometry(value.right) &&
    isUVGeometry(value.top) &&
    isUVGeometry(value.bottom);
}

function isActiveFaces(
  value: unknown
): value is UVFace[] {
  return Array.isArray(value) && value.every(isUVFace);
}

function isUVRegionData(
  value: unknown
): value is UVRegionData {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.color !== "string" ||
    (value.name !== undefined && typeof value.name !== "string") ||
    (value.activeFaces !== undefined && !isActiveFaces(value.activeFaces))
  ) {
    return false;
  }

  if (value.state === "uncollapsed") {
    return isUVFaces(value.faces);
  }

  return (value.state === undefined || value.state === "collapsed") &&
    isRect(value.rect) &&
    (value.faces === undefined || isUVFaces(value.faces));
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
        (metadata.face === null || isUVFace(metadata.face)) &&
        isRect(metadata.rect);
    default:
      return false;
  }
}
