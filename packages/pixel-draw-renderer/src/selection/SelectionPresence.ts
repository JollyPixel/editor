// Import Internal Dependencies
import type { SelectState } from "../tools/SelectState.ts";
import type { RGBA8, SelectionRect } from "../types.ts";

export type SelectionPresenceData =
  | {
    phase: "creating" | "resizing";
    rect: SelectionRect;
  }
  | {
    phase: "selected";
    rect: SelectionRect;
    mask: readonly boolean[];
  }
  | {
    phase: "moving" | "floating";
    sourceRect: SelectionRect;
    liveRect: SelectionRect;
    pixels: readonly RGBA8[];
    mask: readonly boolean[];
    eraseColor: RGBA8;
    blankSource: boolean;
  };

export class SelectionPresence {
  readonly #data: SelectionPresenceData;

  constructor(
    data: SelectionPresenceData
  ) {
    if (!SelectionPresence.#valid(data)) {
      throw new RangeError("Invalid selection presence");
    }
    this.#data = SelectionPresence.#copy(data);
    Object.freeze(this);
  }

  static parse(
    data: unknown
  ): SelectionPresence | null {
    return SelectionPresence.#valid(data)
      ? new SelectionPresence(data)
      : null;
  }

  static capture(
    state: SelectState,
    eraseColor?: RGBA8
  ): SelectionPresence | null {
    if (state.kind === "idle") {
      return null;
    }

    if (
      state.kind === "creating" ||
      state.kind === "resizing"
    ) {
      return new SelectionPresence({
        phase: state.kind,
        rect: state.rect
      });
    }

    const content = state.kind === "moving" ? state.live : state.content;
    if (
      state.kind === "selected" &&
      !state.floating
    ) {
      return new SelectionPresence({
        phase: "selected",
        rect: content.rect,
        mask: content.mask
      });
    }

    if (eraseColor === undefined) {
      throw new RangeError("Selection previews require an erase color");
    }

    return new SelectionPresence({
      phase: state.kind === "moving" ? "moving" : "floating",
      sourceRect: state.content.rect,
      liveRect: content.rect,
      mask: content.mask,
      pixels: content.pixels,
      blankSource: !state.floating,
      eraseColor
    });
  }

  toJSON(): SelectionPresenceData {
    return SelectionPresence.#copy(this.#data);
  }

  static #copy(
    data: SelectionPresenceData
  ): SelectionPresenceData {
    if (!("mask" in data)) {
      return {
        phase: data.phase,
        rect: { ...data.rect }
      };
    }
    if (data.phase === "selected") {
      return {
        phase: "selected",
        rect: { ...data.rect },
        mask: [...data.mask]
      };
    }

    return {
      phase: data.phase,
      sourceRect: { ...data.sourceRect },
      liveRect: { ...data.liveRect },
      pixels: data.pixels.map((pixel) => {
        return { ...pixel };
      }),
      mask: [...data.mask],
      eraseColor: { ...data.eraseColor },
      blankSource: data.blankSource
    };
  }

  static #valid(
    data: unknown
  ): data is SelectionPresenceData {
    if (typeof data !== "object" || data === null || !("phase" in data)) {
      return false;
    }
    if (data.phase === "creating" || data.phase === "resizing") {
      return "rect" in data && SelectionPresence.#rect(data.rect);
    }
    if (data.phase === "selected") {
      return "rect" in data && SelectionPresence.#rect(data.rect) &&
        "mask" in data && SelectionPresence.#mask(
        data.mask,
        data.rect.width * data.rect.height
      );
    }
    if ((data.phase !== "moving" && data.phase !== "floating") ||
      !("sourceRect" in data) || !("liveRect" in data) ||
      !SelectionPresence.#rect(data.sourceRect) ||
      !SelectionPresence.#rect(data.liveRect) ||
      data.sourceRect.width !== data.liveRect.width ||
      data.sourceRect.height !== data.liveRect.height ||
      !("blankSource" in data) || typeof data.blankSource !== "boolean" ||
      (data.phase === "floating" && data.blankSource) ||
      !("eraseColor" in data) || !SelectionPresence.#color(data.eraseColor)) {
      return false;
    }
    const length = data.liveRect.width * data.liveRect.height;

    return "mask" in data && SelectionPresence.#mask(data.mask, length) &&
      "pixels" in data && Array.isArray(data.pixels) &&
      data.pixels.length === length &&
      Array.from(data.pixels).every(SelectionPresence.#color);
  }

  static #rect(
    value: unknown
  ): value is SelectionRect {
    return typeof value === "object" && value !== null &&
      "x" in value && "y" in value &&
      "width" in value && "height" in value &&
      typeof value.x === "number" && typeof value.y === "number" &&
      typeof value.width === "number" && typeof value.height === "number" &&
      Number.isSafeInteger(value.x) && Number.isSafeInteger(value.y) &&
      Number.isSafeInteger(value.width) && Number.isSafeInteger(value.height) &&
      value.width > 0 && value.height > 0 &&
      Number.isSafeInteger(value.width * value.height) &&
      Number.isSafeInteger(value.x + value.width) &&
      Number.isSafeInteger(value.y + value.height);
  }

  static #mask(
    value: unknown,
    length: number
  ): value is boolean[] {
    return Array.isArray(value) && value.length === length &&
      Array.from(value).every((selected) => typeof selected === "boolean") &&
      value.some(Boolean);
  }

  static #color(
    value: unknown
  ): value is RGBA8 {
    return typeof value === "object" && value !== null &&
      "r" in value && "g" in value && "b" in value && "a" in value &&
      [value.r, value.g, value.b, value.a].every((channel) => (
        typeof channel === "number" && Number.isInteger(channel) &&
        channel >= 0 && channel <= 255
      ));
  }
}
