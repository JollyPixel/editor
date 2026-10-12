// Import Internal Dependencies
import type { DropCandidate } from "./dropIndex.ts";
import type { LiveReorder } from "./DragSession.ts";
import { slideOffsets } from "./slideOffsets.ts";

// CONSTANTS
const kLiftedAttribute = "data-lifted";
const kSlide = "translate var(--jolly-duration-exit, 150ms) var(--jolly-easing, ease)";
const kSettleDuration = 150;
const kSettleThreshold = 0.5;
const kReducedMotion = "(prefers-reduced-motion: reduce)";
const kOwners = new WeakMap<HTMLElement, SlidingReorder>();

export interface SlidingReorderOptions {
  /**
   * Children that can trade places, in layout order along `axis`.
   */
  items: readonly HTMLElement[];
  /**
   * Index of the dragged child in `items`.
   */
  from: number;
  axis: "x" | "y";
  /**
   * Pointer position on `axis` when the gesture started, in client pixels.
   */
  pointer: number;
}

export class SlidingReorder implements LiveReorder {
  readonly candidates: DropCandidate[];
  readonly #items: HTMLElement[];
  readonly #from: number;
  readonly #axis: "x" | "y";
  readonly #origin: number;
  readonly #layout: DropCandidate[];
  readonly #minTravel: number;
  readonly #maxTravel: number;
  readonly #motion: boolean;
  #index: number | null = null;
  #lifted = false;

  constructor(
    options: SlidingReorderOptions
  ) {
    const {
      items,
      from,
      axis,
      pointer
    } = options;

    this.#items = [...items];
    this.#from = from;
    this.#axis = axis;
    this.#origin = pointer;
    const view = this.#items[from].ownerDocument.defaultView;
    this.#motion = view?.matchMedia(kReducedMotion).matches !== true;
    for (const item of this.#items) {
      kOwners.set(item, this);
      for (const animation of item.getAnimations()) {
        animation.cancel();
      }
    }

    this.#layout = this.#items.map(
      (item) => extentAlong(item.getBoundingClientRect(), axis)
    );
    const dragged = this.#layout[from];
    const first = this.#layout[0];
    const last = this.#layout[this.#layout.length - 1];
    this.#minTravel = first.start - dragged.start;
    this.#maxTravel = (last.start + last.size) - (dragged.start + dragged.size);

    const shift = pointer - (dragged.start + (dragged.size / 2));
    this.candidates = this.#layout.map((candidate) => {
      return {
        start: candidate.start + shift,
        size: candidate.size
      };
    });
  }

  preview(
    index: number,
    clientX: number,
    clientY: number
  ): void {
    const dragged = this.#items[this.#from];
    if (!this.#lifted) {
      this.#lifted = true;
      dragged.setAttribute(kLiftedAttribute, "");
      dragged.style.transition = "none";
      for (const item of this.#siblings()) {
        item.style.transition = this.#slide();
      }
    }

    const pointer = this.#axis === "x" ? clientX : clientY;
    const travel = Math.min(
      Math.max(pointer - this.#origin, this.#minTravel),
      this.#maxTravel
    );
    dragged.style.translate = this.#translation(travel);
    if (index === this.#index) {
      return;
    }

    this.#index = index;
    const offsets = slideOffsets(this.#layout, this.#from, index);
    for (let position = 0; position < this.#items.length; position++) {
      if (position !== this.#from) {
        this.#items[position].style.translate = this.#translation(
          offsets[position]
        );
      }
    }
  }

  rest(): void {
    if (!this.#lifted) {
      return;
    }

    this.#lifted = false;
    this.#index = null;
    const dragged = this.#items[this.#from];
    dragged.removeAttribute(kLiftedAttribute);
    dragged.style.transition = this.#slide();
    for (const item of this.#items) {
      item.style.translate = "";
    }
  }

  async settle(
    apply?: () => void
  ): Promise<boolean> {
    const before = this.#items.map((item) => item.getBoundingClientRect());
    apply?.();
    await nextFrame();

    const animations: Animation[] = [];
    for (let position = 0; position < this.#items.length; position++) {
      const item = this.#items[position];
      if (kOwners.get(item) !== this) {
        continue;
      }

      item.style.translate = "";
      item.style.transition = "";
      if (!item.isConnected || !this.#motion) {
        continue;
      }

      const after = item.getBoundingClientRect();
      const dx = before[position].x - after.x;
      const dy = before[position].y - after.y;
      if (
        Math.abs(dx) < kSettleThreshold &&
        Math.abs(dy) < kSettleThreshold
      ) {
        continue;
      }

      animations.push(item.animate(
        [
          { translate: `${dx}px ${dy}px` },
          { translate: "0 0" }
        ],
        {
          duration: kSettleDuration,
          easing: "ease-out"
        }
      ));
    }

    await Promise.allSettled(
      animations.map((animation) => animation.finished)
    );
    let owned = false;
    for (const item of this.#items) {
      if (kOwners.get(item) === this) {
        owned = true;
        item.removeAttribute(kLiftedAttribute);
        kOwners.delete(item);
      }
    }

    return owned;
  }

  #siblings(): HTMLElement[] {
    return this.#items.filter((_, position) => position !== this.#from);
  }

  #slide(): string {
    return this.#motion ? kSlide : "none";
  }

  #translation(
    offset: number
  ): string {
    if (offset === 0) {
      return "";
    }

    return this.#axis === "x" ? `${offset}px 0` : `0 ${offset}px`;
  }
}

function extentAlong(
  rect: DOMRect,
  axis: "x" | "y"
): DropCandidate {
  return axis === "x" ?
    {
      start: rect.x,
      size: rect.width
    } :
    {
      start: rect.y,
      size: rect.height
    };
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}
