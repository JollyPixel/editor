// CONSTANTS
const kSettleFrames = 6;

/**
 * Holds an allocated size back while the requested one is still changing,
 * so a live resize does not reallocate GPU targets on every frame.
 */
export class SettledSize {
  #width = 0;
  #height = 0;
  #pendingWidth = 0;
  #pendingHeight = 0;
  #stableFrames = 0;

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  request(
    width: number,
    height: number,
    immediate = false
  ): boolean {
    if (width === this.#width && height === this.#height) {
      this.#stableFrames = 0;

      return false;
    }

    const unallocated = this.#width === 0 || this.#height === 0;
    if (
      width === this.#pendingWidth &&
      height === this.#pendingHeight
    ) {
      this.#stableFrames++;
    }
    else {
      this.#pendingWidth = width;
      this.#pendingHeight = height;
      this.#stableFrames = 0;
    }

    if (
      !immediate &&
      !unallocated &&
      this.#stableFrames < kSettleFrames
    ) {
      return false;
    }

    this.#width = width;
    this.#height = height;
    this.#stableFrames = 0;

    return true;
  }
}
