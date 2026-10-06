// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import type { Placement } from "./Placement.ts";

export interface TemplateSourceRef {
  kind: "template";
  templateId: string;
}

export interface LayerSourceRef {
  kind: "layer";
  layerName: string;
}

export type PlacementSourceRef = TemplateSourceRef | LayerSourceRef;

export interface PlacementPresenceJSON {
  source: PlacementSourceRef;
  position: VoxelCoord;
  transform: number;
}

export class PlacementPresence {
  static of(
    placement: Placement
  ): PlacementPresence {
    const { source } = placement;
    const ref: PlacementSourceRef = source.kind === "template" ?
      {
        kind: "template",
        templateId: source.templateId
      } :
      {
        kind: "layer",
        layerName: source.layerName
      };

    return new PlacementPresence(
      ref,
      placement.position,
      placement.transform
    );
  }

  static parse(
    value: unknown
  ): PlacementPresence | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }

    const source = parseSourceRef(Reflect.get(value, "source"));
    const position = Reflect.get(value, "position");
    const transform = Reflect.get(value, "transform");
    if (
      source === null ||
      !isCellCoord(position) ||
      !isPackedTransform(transform)
    ) {
      return null;
    }

    return new PlacementPresence(
      source,
      position,
      VoxelTransform.fromPacked(transform)
    );
  }

  readonly source: Readonly<PlacementSourceRef>;
  readonly position: Readonly<VoxelCoord>;
  readonly transform: VoxelTransform;

  constructor(
    source: PlacementSourceRef,
    position: VoxelCoord,
    transform: VoxelTransform
  ) {
    this.source = Object.freeze({ ...source });
    this.position = Object.freeze({
      x: position.x,
      y: position.y,
      z: position.z
    });
    this.transform = transform;

    Object.freeze(this);
  }

  equals(
    other: PlacementPresence | null
  ): boolean {
    return other !== null &&
      sameSource(this.source, other.source) &&
      other.position.x === this.position.x &&
      other.position.y === this.position.y &&
      other.position.z === this.position.z &&
      other.transform.equals(this.transform);
  }

  toJSON(): PlacementPresenceJSON {
    return {
      source: { ...this.source },
      position: { ...this.position },
      transform: this.transform.packed
    };
  }
}

function parseSourceRef(
  value: unknown
): PlacementSourceRef | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const kind = Reflect.get(value, "kind");
  if (kind === "template") {
    const templateId = Reflect.get(value, "templateId");

    return isName(templateId) ?
      {
        kind,
        templateId
      } :
      null;
  }
  if (kind === "layer") {
    const layerName = Reflect.get(value, "layerName");

    return isName(layerName) ?
      {
        kind,
        layerName
      } :
      null;
  }

  return null;
}

function sameSource(
  left: PlacementSourceRef,
  right: PlacementSourceRef
): boolean {
  if (left.kind === "template") {
    return right.kind === "template" && right.templateId === left.templateId;
  }

  return right.kind === "layer" && right.layerName === left.layerName;
}

function isName(
  value: unknown
): value is string {
  return typeof value === "string" && value.length > 0;
}

function isCellCoord(
  value: unknown
): value is VoxelCoord {
  return typeof value === "object" && value !== null &&
    Number.isInteger(Reflect.get(value, "x")) &&
    Number.isInteger(Reflect.get(value, "y")) &&
    Number.isInteger(Reflect.get(value, "z"));
}

function isPackedTransform(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    VoxelTransform.fromPacked(value).packed === value;
}
