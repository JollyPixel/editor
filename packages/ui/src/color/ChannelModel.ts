// Import Third-party Dependencies
import {
  ColorSpace,
  hslToHsv,
  hsvToHsl,
  type HSVA,
  type HueColor
} from "@jolly-pixel/color";

// Import Internal Dependencies
import { PickerSpace } from "./space.ts";

// CONSTANTS
const kPercent = 100;
const kChromaDigits = 3;

interface ChannelField<TChannel extends string> {
  key: TChannel | "h";
  scale: number;
  digits?: number;
}

interface HueSibling<TChannel extends string> {
  space: PickerSpace;
  fromPoint?: (point: HSVA) => HueColor<TChannel>;
  toPoint?: (coordinates: HueColor<TChannel>) => HSVA;
}

interface ChannelModelInit<TChannel extends string, TField extends string> {
  space: ColorSpace<TChannel>;
  sibling: HueSibling<TChannel>;
  fields: Readonly<Record<TField, ChannelField<TChannel>>>;
}

export class ChannelModel<TChannel extends string, TField extends string> {
  static readonly hsl = new ChannelModel<"s" | "l", "h" | "s" | "l">({
    space: ColorSpace.hsl,
    sibling: {
      space: PickerSpace.hsv,
      fromPoint: hsvToHsl,
      toPoint: hslToHsv
    },
    fields: {
      h: {
        key: "h",
        scale: 1
      },
      s: {
        key: "s",
        scale: kPercent
      },
      l: {
        key: "l",
        scale: kPercent
      }
    }
  });

  static readonly oklch = new ChannelModel<"l" | "c", "okl" | "okc" | "okh">({
    space: ColorSpace.oklch,
    sibling: {
      space: PickerSpace.okhsv
    },
    fields: {
      okl: {
        key: "l",
        scale: kPercent
      },
      okc: {
        key: "c",
        scale: 1,
        digits: kChromaDigits
      },
      okh: {
        key: "h",
        scale: 1
      }
    }
  });

  readonly #init: ChannelModelInit<TChannel, TField>;

  constructor(
    init: ChannelModelInit<TChannel, TField>
  ) {
    this.#init = init;
  }

  read(
    point: HSVA,
    space: PickerSpace
  ): Record<TField, number> {
    const coordinates = this.#coordinates(point, space);
    const entries = Object.entries<ChannelField<TChannel>>(this.#init.fields).map(
      ([channel, field]) => [
        channel,
        Number((coordinates[field.key] * field.scale).toFixed(field.digits ?? 0))
      ]
    );

    return Object.fromEntries(entries) as Record<TField, number>;
  }

  write(
    point: HSVA,
    channel: TField,
    value: number,
    space: PickerSpace
  ): HSVA {
    const { key, scale } = this.#init.fields[channel];
    const { sibling } = this.#init;
    const shared = space === sibling.space;
    if (shared && key === "h") {
      return {
        ...point,
        h: value
      };
    }

    const next: HueColor<TChannel> = {
      ...this.#coordinates(point, space),
      [key]: value / scale
    };
    if (shared && sibling.toPoint !== undefined) {
      const { s, v } = sibling.toPoint(next);

      return {
        ...point,
        s,
        v
      };
    }

    return space.fromRgb(this.#init.space.toRgb(next), point);
  }

  #coordinates(
    point: HSVA,
    space: PickerSpace
  ): HueColor<TChannel> {
    const { space: target, sibling } = this.#init;
    if (space !== sibling.space) {
      const previous: Partial<HueColor<TChannel>> = {};
      previous.h = target.fromRgb(space.pureHue(point)).h;

      return target.fromRgb(space.toRgb(point), previous);
    }

    return {
      ...(sibling.fromPoint?.(point) ?? target.fromRgb(space.toRgb(point))),
      h: point.h
    };
  }
}
