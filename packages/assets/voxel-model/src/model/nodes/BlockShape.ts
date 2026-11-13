// Import Third-party Dependencies
import {
  DEFAULT_UV_SLOTS,
  type UVSlot
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type {
  BlockShapeJSON,
  BlockShapeType
} from "../types.ts";

// CONSTANTS
export type BlockShapeParameter = "sides" | "ringSides" | "thickness";

export interface BlockShapeRange {
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface BlockShapeValue extends BlockShapeRange {
  key: BlockShapeParameter;
  value: number;
}

export const BLOCK_SHAPE_PARAMETERS: Readonly<
  Record<BlockShapeParameter, Readonly<BlockShapeRange>>
> = Object.freeze({
  sides: Object.freeze({ min: 3, max: 32, step: 1, default: 8 }),
  ringSides: Object.freeze({ min: 3, max: 32, step: 1, default: 6 }),
  thickness: Object.freeze({ min: 0.05, max: 0.95, step: 0.05, default: 0.35 })
});

const kParameters = ["sides", "ringSides", "thickness"] as const satisfies readonly BlockShapeParameter[];
const kSidePrefix = "side-";

interface BlockShapeKind<TShape extends BlockShapeJSON> {
  defaults: Readonly<TShape>;
  caps: readonly UVSlot[];
  round: "sides" extends keyof TShape ? true : false;
  pointed: boolean;
}

type BlockShapeKinds = {
  readonly [TType in BlockShapeType]: BlockShapeKind<BlockShapeJSON & { type: TType; }>;
};

const { sides, ringSides, thickness } = BLOCK_SHAPE_PARAMETERS;
const kKinds: BlockShapeKinds = {
  box: {
    defaults: Object.freeze({ type: "box" }),
    caps: DEFAULT_UV_SLOTS,
    round: false,
    pointed: false
  },
  plane: {
    defaults: { type: "plane" },
    caps: ["top"],
    round: false,
    pointed: false
  },
  cylinder: {
    defaults: { type: "cylinder", sides: sides.default },
    caps: ["top", "bottom"],
    round: true,
    pointed: false
  },
  cone: {
    defaults: { type: "cone", sides: sides.default },
    caps: ["bottom"],
    round: true,
    pointed: true
  },
  torus: {
    defaults: {
      type: "torus",
      sides: sides.default,
      ringSides: ringSides.default,
      thickness: thickness.default
    },
    caps: [],
    round: true,
    pointed: false
  }
};

type BlockShapeFields = Pick<BlockShapeJSON, "type"> & Partial<Record<BlockShapeParameter, number>>;

export class BlockShape {
  static readonly box: Readonly<BlockShapeJSON> = kKinds.box.defaults;

  static create(
    type: BlockShapeType
  ): BlockShapeJSON {
    return { ...kKinds[type].defaults };
  }

  static isRound(
    shape: BlockShapeJSON
  ): boolean {
    return kKinds[shape.type].round;
  }

  static isPointed(
    shape: BlockShapeJSON
  ): boolean {
    return kKinds[shape.type].pointed;
  }

  static parameters(
    shape: BlockShapeJSON
  ): BlockShapeValue[] {
    const fields: BlockShapeFields = shape;

    return kParameters.flatMap((key) => {
      const value = fields[key];

      return value === undefined ?
        [] :
        [{ key, value, ...BLOCK_SHAPE_PARAMETERS[key] }];
    });
  }

  static withParameter(
    shape: BlockShapeJSON,
    key: BlockShapeParameter,
    value: number
  ): BlockShapeJSON {
    const fields: BlockShapeFields = shape;
    if (fields[key] === undefined) {
      throw new RangeError(`A ${shape.type} has no "${key}" parameter.`);
    }

    const { min, max, step } = BLOCK_SHAPE_PARAMETERS[key];
    const decimals = String(step).split(".")[1]?.length ?? 0;
    const snapped = Number((Math.round(value / step) * step).toFixed(decimals));

    return {
      ...shape,
      [key]: Math.min(max, Math.max(min, snapped))
    };
  }

  static slots(
    shape: BlockShapeJSON
  ): UVSlot[] {
    const { caps } = kKinds[shape.type];

    return "sides" in shape ?
      [...BlockShape.sideSlots(shape.sides), ...caps] :
      [...caps];
  }

  static sideSlots(
    sides: number
  ): UVSlot[] {
    return Array.from({ length: sides }, (_, index) => `${kSidePrefix}${index}`);
  }

  static isSideSlot(
    slot: UVSlot
  ): boolean {
    return slot.startsWith(kSidePrefix);
  }

  static same(
    left: BlockShapeJSON,
    right: BlockShapeJSON
  ): boolean {
    const leftFields: BlockShapeFields = left;
    const rightFields: BlockShapeFields = right;

    return left.type === right.type &&
      kParameters.every((key) => leftFields[key] === rightFields[key]);
  }
}
