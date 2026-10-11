// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import {
  CellRegion,
  isCellCoord,
  sameCellCoord
} from "../CellRegion.ts";
import type { Placement } from "../Placement.ts";
import type { PlacementSourceRef } from "../PlacementSource.ts";

export interface PlacementPresenceJSON {
  source: PlacementSourceRef;
  position: VoxelCoord;
  transform: number;
}

export class PlacementPresence {
  static fromPlacement(
    placement: Placement
  ): PlacementPresence {
    return new PlacementPresence(
      placement.source.toRef(),
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
      sameCellCoord(other.position, this.position) &&
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
  if (kind === "copy") {
    const copyId = Reflect.get(value, "copyId");

    return isName(copyId) ?
      {
        kind,
        copyId
      } :
      null;
  }
  const layerName = Reflect.get(value, "layerName");
  if (!isName(layerName)) {
    return null;
  }
  if (kind === "layer") {
    return {
      kind,
      layerName
    };
  }
  if (kind === "region") {
    const region = CellRegion.parse(Reflect.get(value, "region"));

    return region === null ?
      null :
      {
        kind,
        layerName,
        region: region.toJSON()
      };
  }

  return null;
}

function sameSource(
  left: PlacementSourceRef,
  right: PlacementSourceRef
): boolean {
  switch (left.kind) {
    case "template":
      return right.kind === "template" &&
        right.templateId === left.templateId;
    case "layer":
      return right.kind === "layer" && right.layerName === left.layerName;
    case "region":
      return right.kind === "region" &&
        right.layerName === left.layerName &&
        sameCellCoord(right.region.min, left.region.min) &&
        sameCellCoord(right.region.max, left.region.max);
    case "copy":
      return right.kind === "copy" && right.copyId === left.copyId;
  }
}

function isName(
  value: unknown
): value is string {
  return typeof value === "string" && value.length > 0;
}

function isPackedTransform(
  value: unknown
): value is number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    VoxelTransform.fromPacked(value).packed === value;
}
