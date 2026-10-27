export interface CanvasDimensions {
  width: number;
  height: number;
}

export class CanvasSize {
  ratio: number | null = null;

  #width = 0;
  #height = 0;
  #appliedWidth = 0;
  #appliedHeight = 0;

  get width(): number {
    return this.#width;
  }

  get height(): number {
    return this.#height;
  }

  get isEmpty(): boolean {
    return this.#width === 0 || this.#height === 0;
  }

  fit(
    width: number,
    height: number
  ): void {
    if (!this.ratio) {
      this.#width = Math.round(width);
      this.#height = Math.round(height);
    }
    else if (width / height > this.ratio) {
      this.#height = Math.round(height);
      this.#width = Math.round(Math.min(width, height * this.ratio));
    }
    else {
      this.#width = Math.round(width);
      this.#height = Math.round(Math.min(height, width / this.ratio));
    }
  }

  commit(): CanvasDimensions | null {
    if (
      this.isEmpty ||
      (this.#width === this.#appliedWidth && this.#height === this.#appliedHeight)
    ) {
      return null;
    }
    this.#appliedWidth = this.#width;
    this.#appliedHeight = this.#height;

    return {
      width: this.#width,
      height: this.#height
    };
  }
}
