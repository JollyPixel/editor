// Import Internal Dependencies
import type {
  UVCompoundPart,
  UVGeometry,
  UVNormalizedRect,
  UVSlot,
  UVTriangleCorner
} from "./types.ts";
import type { UVRegionData } from "./UVRegion.ts";
import type { SelectionRect } from "../types.ts";

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

export function isUVSlot(
  value: unknown
): value is UVSlot {
  return typeof value === "string" && value.length > 0;
}

export function isUVTextureRect(
  value: unknown
): value is SelectionRect {
  return isRecord(value) &&
    isFiniteNumber(value.x) &&
    isFiniteNumber(value.y) &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    value.width > 0 &&
    value.height > 0;
}

export function isUVNormalizedRect(
  value: unknown
): value is UVNormalizedRect {
  if (!isUVTextureRect(value)) {
    return false;
  }

  return value.x >= 0 &&
    value.y >= 0 &&
    value.x + value.width <= 1 &&
    value.y + value.height <= 1;
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
    return isUVNormalizedRect(value);
  }

  return value.shape === "triangle" &&
    isUVTriangleCorner(value.corner) &&
    isUVNormalizedRect(value.rect);
}

export function isUVGeometry(
  value: unknown
): value is UVGeometry {
  if (!isRecord(value) || !("shape" in value)) {
    return isUVTextureRect(value);
  }

  if (value.shape === "compound") {
    return isUVTextureRect(value.rect) &&
      Array.isArray(value.parts) &&
      value.parts.length > 0 &&
      value.parts.every(isUVCompoundPart);
  }

  return value.shape === "triangle" &&
    isUVTriangleCorner(value.corner) &&
    isUVTextureRect(value.rect);
}

function isUVSlots(
  value: unknown
): value is Record<UVSlot, UVGeometry> {
  if (!isRecord(value)) {
    return false;
  }

  const slots = Object.keys(value);

  return slots.length > 0 &&
    slots.every((slot) => isUVSlot(slot) && isUVGeometry(value[slot]));
}

function isActiveSlots(
  value: unknown
): value is UVSlot[] {
  return Array.isArray(value) && value.every(isUVSlot);
}

export function isUVRegionData(
  value: unknown
): value is UVRegionData {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    value.id.length === 0 ||
    typeof value.color !== "string" ||
    (value.name !== undefined && typeof value.name !== "string") ||
    (value.activeFaces !== undefined && !isActiveSlots(value.activeFaces))
  ) {
    return false;
  }

  const faces = value.faces;
  if (
    isActiveSlots(value.activeFaces) &&
    isRecord(faces) &&
    !value.activeFaces.every((slot) => slot in faces)
  ) {
    return false;
  }

  if (value.state === "uncollapsed") {
    return isUVSlots(faces);
  }

  return (value.state === undefined || value.state === "collapsed") &&
    isUVTextureRect(value.rect) &&
    (faces === undefined || isUVSlots(faces)) &&
    (value.collapsedFace === undefined || isUVSlot(value.collapsedFace));
}
