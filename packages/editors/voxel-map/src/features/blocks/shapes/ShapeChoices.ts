// Import Third-party Dependencies
import type {
  BlockShapeID,
  BlockShapeRegistry
} from "@jolly-pixel/voxel.renderer";
import {
  registerIcon,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import { ShapeGlyph } from "./ShapeGlyph.ts";

interface ShapeName {
  readonly group: string;
  readonly label: string;
}

// CONSTANTS
const kCustomGroup = "Custom";
const kGroupLabels: Record<string, Record<string, string>> = {
  Block: {
    cube: "Cube",
    slabBottom: "Bottom slab",
    slabTop: "Top slab",
    slabBeam: "Beam",
    slabCorner: "Corner slab",
    slabNotch: "Notched slab"
  },
  Wall: {
    wall: "Wall",
    wallCorner: "Wall corner",
    wallTee: "Wall tee",
    wallCross: "Wall cross"
  },
  Ramp: {
    ramp: "Ramp",
    rampCornerInner: "Inner ramp corner",
    rampCornerOuter: "Outer ramp corner",
    rampTip: "Ramp tip",
    rampValley: "Ramp valley"
  },
  Stair: {
    stair: "Stair",
    stairCornerInner: "Inner stair corner",
    stairCornerOuter: "Outer stair corner",
    stairCornerPeak: "Stair peak"
  },
  Pole: {
    poleY: "Post",
    poleEndUp: "Pole end, rising",
    poleEndThrough: "Pole end, through",
    pole: "Pole",
    poleUp: "Pole, rising",
    poleThrough: "Pole, through",
    poleCorner: "Pole corner",
    poleCornerUp: "Pole corner, rising",
    poleCornerThrough: "Pole corner, through",
    poleTee: "Pole tee",
    poleTeeUp: "Pole tee, rising",
    poleTeeThrough: "Pole tee, through",
    poleCross: "Pole cross",
    poleCrossUp: "Pole cross, rising",
    poleCrossThrough: "Pole cross, through"
  }
};
const kCatalogue = new Map(
  Object.entries(kGroupLabels).flatMap(
    ([group, labels]) => Object.entries(labels).map(
      ([id, label]): [string, ShapeName] => [id, { group, label }]
    )
  )
);
const kBuilt = new WeakMap<BlockShapeRegistry, ShapeChoices>();

export class ShapeChoices {
  static readonly COLUMNS = 6;

  readonly version: number;
  readonly options: JollyOption<BlockShapeID>[];

  constructor(
    shapes: BlockShapeRegistry
  ) {
    const ordered = [
      ...[...kCatalogue.keys()].flatMap((id) => shapes.get(id) ?? []),
      ...[...shapes].filter((shape) => !kCatalogue.has(shape.id))
    ];

    this.version = shapes.version;
    this.options = ordered.map((shape) => {
      const icon = `block-shape-${shape.id}`;
      registerIcon(icon, new ShapeGlyph(shape).toSVG(), {
        tone: "sky",
        viewBox: ShapeGlyph.VIEW_BOX
      });
      const name = kCatalogue.get(shape.id);

      return {
        value: shape.id,
        label: name?.label ?? shape.id,
        group: name?.group ?? kCustomGroup,
        icon
      };
    });
  }

  static from(
    shapes: BlockShapeRegistry
  ): ShapeChoices {
    let choices = kBuilt.get(shapes);
    if (choices?.version !== shapes.version) {
      choices = new ShapeChoices(shapes);
      kBuilt.set(shapes, choices);
    }

    return choices;
  }
}
