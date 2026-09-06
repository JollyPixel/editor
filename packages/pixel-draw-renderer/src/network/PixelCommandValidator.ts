// Import Internal Dependencies
import type {
  RGBA8,
  SelectionRect,
  Vec2
} from "../types.ts";
import type {
  PixelNetworkCommand
} from "./types.ts";
import type {
  UVFace,
  UVCompoundPart,
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
): value is RGBA8 {
  return isRecord(value) &&
    isFiniteNumber(value.r) &&
    isFiniteNumber(value.g) &&
    isFiniteNumber(value.b) &&
    isFiniteNumber(value.a);
}

/**
 * A slot vocabulary is open, so a face is validated by shape, not by name.
 */
function isUVFace(
  value: unknown
): value is UVFace {
  return typeof value === "string" && value.length > 0;
}

function isUVTriangleCorner(
  value: unknown
): value is UVTriangleCorner {
  return value === "top-left" ||
    value === "top-right" ||
    value === "bottom-left" ||
    value === "bottom-right";
}

function isUVCompoundPart(
  value: unknown
): value is UVCompoundPart {
  if (!isRecord(value) || !("shape" in value)) {
    return isRect(value);
  }

  return value.shape === "triangle" &&
    isUVTriangleCorner(value.corner) &&
    isRect(value.rect);
}

function isUVGeometry(
  value: unknown
): value is UVGeometry {
  if (!isRecord(value) || !("shape" in value)) {
    return isRect(value);
  }

  if (value.shape === "compound") {
    return isRect(value.rect) &&
      Array.isArray(value.parts) &&
      value.parts.length > 0 &&
      value.parts.every(isUVCompoundPart);
  }

  return value.shape === "triangle" &&
    isUVTriangleCorner(value.corner) &&
    isRect(value.rect);
}

/**
 * Every value is a geometry and the record carries at least one slot.
 */
function isUVFaces(
  value: unknown
): value is Record<UVFace, UVGeometry> {
  if (!isRecord(value)) {
    return false;
  }

  const faces = Object.keys(value);

  return faces.length > 0 &&
    faces.every((face) => isUVFace(face) && isUVGeometry(value[face]));
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

  const faces = value.faces;
  if (
    isActiveFaces(value.activeFaces) &&
    isRecord(faces) &&
    !value.activeFaces.every((face) => face in faces)
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
