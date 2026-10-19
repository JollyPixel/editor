// CONSTANTS
const kDomDeltaPixel = 0;
const kNotchDelta = 120;
const kGestureGapMs = 200;

export type ScrollSource = "wheel" | "touchpad" | "zoom";
export type ScrollDevice = "auto" | "wheel" | "touchpad";

export type LegacyWheelEvent = WheelEvent & {
  readonly wheelDeltaX?: number;
  readonly wheelDeltaY?: number;
};

export class WheelGesture {
  device: ScrollDevice = "auto";

  #touchpad = false;
  #lastTimeStamp = Number.NEGATIVE_INFINITY;

  classify(
    event: LegacyWheelEvent
  ): ScrollSource {
    if (event.ctrlKey) {
      return "zoom";
    }
    if (this.device !== "auto") {
      return this.device;
    }

    if (event.timeStamp - this.#lastTimeStamp > kGestureGapMs) {
      this.#touchpad = false;
    }
    this.#lastTimeStamp = event.timeStamp;
    this.#touchpad ||= WheelGesture.#looksLikeTouchpad(event);

    return this.#touchpad ? "touchpad" : "wheel";
  }

  reset(): void {
    this.#touchpad = false;
    this.#lastTimeStamp = Number.NEGATIVE_INFINITY;
  }

  static #looksLikeTouchpad(
    event: LegacyWheelEvent
  ): boolean {
    if (event.deltaMode !== kDomDeltaPixel) {
      return false;
    }

    const { wheelDeltaX = 0, wheelDeltaY = 0 } = event;

    return wheelDeltaX % kNotchDelta !== 0 ||
      wheelDeltaY % kNotchDelta !== 0 ||
      (event.deltaX !== 0 && !event.shiftKey);
  }
}
