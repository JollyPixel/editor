// Import Third-party Dependencies
import type { AnchorRect } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { TargetPath } from "./TargetPath.ts";
import type { StepTarget } from "./TourStep.ts";

// CONSTANTS
const kSeekMs = 1_000;

export type TargetFrame<TAnchor> =
  | {
    kind: "seeking";
  }
  | {
    kind: "centred";
  }
  | {
    kind: "anchored";
    anchor: TAnchor;
  };

export type TargetMeasure<TAnchor> = (
  found: Element | AnchorRect
) => TAnchor | null;

export interface TargetSeekOptions {
  target: StepTarget | null;
  page: Document;
  warn: (message: string) => void;
}

export class TargetSeek {
  #target: StepTarget | null;
  #page: Document;
  #warn: (message: string) => void;
  #since: number | null = null;
  #gaveUp = false;

  constructor(
    options: TargetSeekOptions
  ) {
    this.#target = options.target;
    this.#page = options.page;
    this.#warn = options.warn;
  }

  frame<TAnchor>(
    now: number,
    measure: TargetMeasure<TAnchor>
  ): TargetFrame<TAnchor> {
    const target = this.#target;
    if (target === null) {
      return { kind: "centred" };
    }

    this.#since ??= now;
    const found = this.#resolve(target);
    const anchor = found === null ? null : measure(found);
    if (anchor !== null) {
      return {
        kind: "anchored",
        anchor
      };
    }
    if (now - this.#since >= kSeekMs) {
      this.#giveUp(
        `no target found for ${TargetSeek.#describe(target)}, the card is centred`
      );
    }

    return this.#gaveUp ? { kind: "centred" } : { kind: "seeking" };
  }

  #resolve(
    target: StepTarget
  ): Element | AnchorRect | null {
    try {
      return target instanceof TargetPath ?
        target.resolve(this.#page) :
        target();
    }
    catch (error) {
      this.#giveUp(`target failed, ${String(error)}`);

      return null;
    }
  }

  #giveUp(
    reason: string
  ): void {
    if (!this.#gaveUp) {
      this.#gaveUp = true;
      this.#warn(reason);
    }
  }

  static #describe(
    target: StepTarget
  ): string {
    return target instanceof TargetPath ?
      `"${target}"` :
      "the target function";
  }
}
