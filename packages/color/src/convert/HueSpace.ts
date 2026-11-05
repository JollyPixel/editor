// Import Internal Dependencies
import {
  ColorSpace,
  type HueColor
} from "./ColorSpace.ts";
import {
  hslToHsv,
  hsvToHsl
} from "./hsl.ts";
import type {
  HSVA,
  RGBA
} from "../types.ts";

export type HueSpaceName = "hsv" | "okhsv" | "okhsl";

export type HueLevel = "value" | "lightness";

export interface HueSibling {
  space: ColorSpace<string>;
  fromPoint?: (point: HSVA) => HueColor<string>;
  toPoint?: (color: HueColor<string>) => Pick<HSVA, "s" | "v">;
}

export interface HueSpaceInit {
  name: HueSpaceName;
  level: HueLevel;
  pureLevel: number;
  toRgb: (point: HSVA) => RGBA;
  fromRgb: (color: RGBA, previous?: HSVA) => HSVA;
  siblings: readonly HueSibling[];
}

export class HueSpace {
  static readonly hsv = new HueSpace({
    name: "hsv",
    level: "value",
    pureLevel: 1,
    toRgb: (point) => ColorSpace.hsv.toRgb(point),
    fromRgb: (color, previous) => ColorSpace.hsv.fromRgb(color, previous),
    siblings: [
      {
        space: ColorSpace.hsl,
        fromPoint: (point) => {
          return { ...hsvToHsl(point) };
        },
        toPoint: (color) => hslToHsv({
          h: color.h,
          s: color.s,
          l: color.l,
          a: color.a
        })
      }
    ]
  });

  static readonly okhsv = new HueSpace({
    name: "okhsv",
    level: "value",
    pureLevel: 1,
    toRgb: (point) => ColorSpace.okhsv.toRgb(point),
    fromRgb: (color, previous) => ColorSpace.okhsv.fromRgb(color, previous),
    siblings: [
      {
        space: ColorSpace.oklch
      }
    ]
  });

  static readonly okhsl = new HueSpace({
    name: "okhsl",
    level: "lightness",
    pureLevel: 0.5,
    toRgb: (point) => ColorSpace.okhsl.toRgb({
      h: point.h,
      s: point.s,
      l: point.v,
      a: point.a
    }),
    fromRgb: (color, previous) => {
      const { h, s, l, a } = ColorSpace.okhsl.fromRgb(
        color,
        previous && {
          h: previous.h,
          s: previous.s,
          l: previous.v,
          a: previous.a
        }
      );

      return {
        h,
        s,
        v: l,
        a
      };
    },
    siblings: [
      {
        space: ColorSpace.oklch
      }
    ]
  });

  static named(
    name: HueSpaceName
  ): HueSpace {
    switch (name) {
      case "okhsv":
        return HueSpace.okhsv;
      case "okhsl":
        return HueSpace.okhsl;
      default:
        return HueSpace.hsv;
    }
  }

  readonly name: HueSpaceName;
  readonly level: HueLevel;
  readonly pureLevel: number;
  readonly #init: HueSpaceInit;

  constructor(
    init: HueSpaceInit
  ) {
    this.name = init.name;
    this.level = init.level;
    this.pureLevel = init.pureLevel;
    this.#init = init;
  }

  toRgb(
    point: HSVA
  ): RGBA {
    return this.#init.toRgb(point);
  }

  fromRgb(
    color: RGBA,
    previous?: HSVA
  ): HSVA {
    return this.#init.fromRgb(color, previous);
  }

  pureHue(
    point: HSVA
  ): RGBA {
    return this.#init.toRgb({
      h: point.h,
      s: 1,
      v: this.pureLevel,
      a: 1
    });
  }

  convert(
    point: HSVA,
    target: HueSpace
  ): HSVA {
    if (target === this) {
      return point;
    }

    return target.fromRgb(this.toRgb(point), point);
  }

  read<TChannel extends string>(
    point: HSVA,
    space: ColorSpace<TChannel>
  ): HueColor<TChannel> {
    const sibling = this.#sibling(space);
    if (sibling === undefined) {
      const previous: Partial<HueColor<TChannel>> = {};
      previous.h = space.fromRgb(this.pureHue(point)).h;

      return space.fromRgb(this.toRgb(point), previous);
    }

    const coordinates = sibling.fromPoint?.(point) ?? space.fromRgb(this.toRgb(point));

    return {
      ...coordinates,
      h: point.h
    } as HueColor<TChannel>;
  }

  write<TChannel extends string>(
    point: HSVA,
    space: ColorSpace<TChannel>,
    channel: TChannel | "h",
    value: number
  ): HSVA {
    const sibling = this.#sibling(space);
    if (sibling !== undefined && channel === "h") {
      return {
        ...point,
        h: value
      };
    }

    const next: HueColor<TChannel> = {
      ...this.read(point, space),
      [channel]: value
    };
    if (sibling?.toPoint !== undefined) {
      const { s, v } = sibling.toPoint(next);

      return {
        ...point,
        s,
        v
      };
    }

    return this.fromRgb(space.toRgb(next), point);
  }

  #sibling(
    space: ColorSpace<string>
  ): HueSibling | undefined {
    return this.#init.siblings.find((sibling) => sibling.space === space);
  }
}
