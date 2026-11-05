// Import Third-party Dependencies
import {
  ColorSpace,
  type HSVA,
  type HueSpace
} from "@jolly-pixel/color";

// CONSTANTS
const kPercent = 100;
const kChromaDigits = 3;

interface ChannelField<TChannel extends string> {
  key: TChannel | "h";
  scale: number;
  digits?: number;
}

interface ChannelModelInit<TChannel extends string, TField extends string> {
  space: ColorSpace<TChannel>;
  fields: Readonly<Record<TField, ChannelField<TChannel>>>;
}

export class ChannelModel<TChannel extends string, TField extends string> {
  static readonly hsl = new ChannelModel<"s" | "l", "h" | "s" | "l">({
    space: ColorSpace.hsl,
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
    space: HueSpace
  ): Record<TField, number> {
    const coordinates = space.read(point, this.#init.space);
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
    space: HueSpace
  ): HSVA {
    const { key, scale } = this.#init.fields[channel];

    return space.write(point, this.#init.space, key, value / scale);
  }
}
