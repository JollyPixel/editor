// CONSTANTS
const kDefaultPosition = "bottom-right";
const kDefaultInset = 0;

export type ViewHelperPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export interface ViewHelperOptions {
  position?: ViewHelperPosition;
  inset?: number;
}

export class ViewHelperSettings {
  readonly position: ViewHelperPosition;
  readonly inset: number;
  #hidden = false;
  #invalidate: () => void;

  constructor(
    options: ViewHelperOptions,
    invalidate: () => void
  ) {
    this.position = options.position ?? kDefaultPosition;
    this.inset = options.inset ?? kDefaultInset;
    this.#invalidate = invalidate;
  }

  get hidden(): boolean {
    return this.#hidden;
  }

  set hidden(
    value: boolean
  ) {
    if (value === this.#hidden) {
      return;
    }

    this.#hidden = value;
    this.#invalidate();
  }
}
