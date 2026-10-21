// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  PaneElement,
  type AnchorRect
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { TargetFrame } from "../tour/TargetSeek.ts";
import type { TourRun } from "../tour/TourRun.ts";
import { CornerRadii } from "./spotlight/CornerRadii.ts";
import type { TargetAnchor } from "./spotlight/SpotlightPlacement.ts";

export class TargetTracker implements ReactiveController {
  #frame: (frame: TargetFrame<TargetAnchor>) => void;
  #run: TourRun | null = null;
  #request = 0;

  constructor(
    host: ReactiveControllerHost,
    frame: (frame: TargetFrame<TargetAnchor>) => void
  ) {
    this.#frame = frame;
    host.addController(this);
  }

  track(
    run: TourRun
  ): void {
    this.stop();
    this.#run = run;
    this.#request = requestAnimationFrame(this.#tick);
  }

  stop(): void {
    if (this.#request !== 0) {
      cancelAnimationFrame(this.#request);
    }
    this.#request = 0;
    this.#run = null;
  }

  hostDisconnected(): void {
    this.stop();
  }

  readonly #tick = (
    now: number
  ): void => {
    const run = this.#run;
    if (run === null) {
      return;
    }

    this.#frame(run.seek(now, TargetTracker.#measure));
    this.#request = requestAnimationFrame(this.#tick);
  };

  static #measure(
    found: Element | AnchorRect
  ): TargetAnchor | null {
    if (!(found instanceof Element)) {
      return {
        rect: found,
        radii: CornerRadii.SQUARE
      };
    }

    const element = found instanceof PaneElement ?
      found.chromeElement :
      found;
    const rect = element.getBoundingClientRect();

    return element.isConnected && (rect.width > 0 || rect.height > 0) ?
      {
        rect,
        radii: CornerRadii.read(element)
      } :
      null;
  }
}
