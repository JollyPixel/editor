// Import Internal Dependencies
import {
  FACE_AXIS,
  FACE_POSITIVE,
  FACES,
  type FACE
} from "../../utils/math.ts";
import type { FaceDefinition } from "../face/index.ts";
import type { BlockShape } from "./BlockShape.ts";

// CONSTANTS
const kEpsilon = 1e-6;
const kFaceSlotNames: readonly string[] = [
  "right",
  "left",
  "top",
  "bottom",
  "front",
  "back"
];
const kSlotCache = new WeakMap<BlockShape, readonly ShapeSlot[]>();

export interface ShapeSlot {
  /**
   * Key a block's `faceTextures` is looked up with.
   */
  id: string;
  face: FACE;
  definitions: readonly FaceDefinition[];
}

export function slotNameOf(
  face: FACE
): string {
  return kFaceSlotNames[face];
}

/**
 * Slot a derived slot inherits its tile from, so `top.1` falls back to `top`.
 */
export function baseSlotOf(
  slot: string
): string {
  const separator = slot.indexOf(".");

  return separator === -1 ? slot : slot.slice(0, separator);
}

/**
 * Slots of `shape`, ordered by face then by distance from the boundary plane.
 * Memoized, so callers may compare identities.
 */
export function shapeSlots(
  shape: BlockShape
): readonly ShapeSlot[] {
  const cached = kSlotCache.get(shape);
  if (cached) {
    return cached;
  }

  const slots = deriveSlots(shape.faces);
  kSlotCache.set(shape, slots);

  return slots;
}

interface SlotGroup {
  /**
   * Distance from the boundary plane, `Infinity` when the polygon is not
   * planar on its face axis.
   */
  distance: number;
  order: number;
  definitions: FaceDefinition[];
}

function deriveSlots(
  faces: readonly FaceDefinition[]
): readonly ShapeSlot[] {
  const slots: ShapeSlot[] = [];

  for (const face of FACES) {
    const groups = groupByPlane(
      faces.filter((definition) => definition.face === face)
    );
    if (groups.length === 0) {
      continue;
    }

    const [pinned, derived] = partitionPinned(groups);
    const used = new Set<string>(pinned.keys());

    for (const [id, definitions] of pinned) {
      slots.push({ id, face, definitions });
    }
    for (const group of derived) {
      const id = nextFreeSlotId(slotNameOf(face), used);
      used.add(id);
      slots.push({
        id,
        face,
        definitions: group.definitions
      });
    }
  }

  return slots;
}

function nextFreeSlotId(
  name: string,
  used: ReadonlySet<string>
): string {
  if (!used.has(name)) {
    return name;
  }

  let suffix = 1;
  while (used.has(`${name}.${suffix}`)) {
    suffix++;
  }

  return `${name}.${suffix}`;
}

function groupByPlane(
  definitions: readonly FaceDefinition[]
): SlotGroup[] {
  const groups: SlotGroup[] = [];

  definitions.forEach((definition, order) => {
    const distance = boundaryDistance(definition);
    const existing = distance === Infinity ?
      undefined :
      groups.find((group) => Math.abs(group.distance - distance) < kEpsilon);

    if (existing) {
      existing.definitions.push(definition);
    }
    else {
      groups.push({
        distance,
        order,
        definitions: [definition]
      });
    }
  });

  return groups.sort(
    (a, b) => (a.distance - b.distance) || (a.order - b.order)
  );
}

function partitionPinned(
  groups: readonly SlotGroup[]
): [Map<string, FaceDefinition[]>, SlotGroup[]] {
  const pinned = new Map<string, FaceDefinition[]>();
  const derived: SlotGroup[] = [];

  for (const group of groups) {
    const unpinned: FaceDefinition[] = [];

    for (const definition of group.definitions) {
      if (definition.slot === null || definition.slot === undefined) {
        unpinned.push(definition);
        continue;
      }

      const bucket = pinned.get(definition.slot);
      if (bucket) {
        bucket.push(definition);
      }
      else {
        pinned.set(definition.slot, [definition]);
      }
    }

    if (unpinned.length > 0) {
      derived.push({
        ...group,
        definitions: unpinned
      });
    }
  }

  return [pinned, derived];
}

function boundaryDistance(
  definition: FaceDefinition
): number {
  const axis = FACE_AXIS[definition.face];
  const [first] = definition.vertices;
  const plane = first[axis];

  for (const vertex of definition.vertices) {
    if (Math.abs(vertex[axis] - plane) > kEpsilon) {
      return Infinity;
    }
  }

  return FACE_POSITIVE[definition.face] ? 1 - plane : plane;
}
