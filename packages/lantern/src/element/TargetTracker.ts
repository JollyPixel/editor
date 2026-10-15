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
import type { LanternSession } from "../session/LanternSession.ts";
import { TargetPath } from "../tour/TargetPath.ts";
import type { StepTarget } from "../tour/TourStep.ts";
import {
  SQUARE_CORNERS,
  type CornerRadii
} from "./spotlight.ts";

// CONSTANTS
const kRetryMs = 1_000;

export interface TargetAnchor {
  rect: AnchorRect;
  radii: CornerRadii;
}

export type TargetFrame =
  | {
    kind: "seeking";
  }
  | {
    kind: "centred";
  }
  | ({
    kind: "anchored";
  } & TargetAnchor);

export class TargetTracker implements ReactiveController {
  #frame: (frame: TargetFrame) => void;
  #session: LanternSession | null = null;
  #request = 0;
  #since = 0;
  #gaveUp = false;

  constructor(
    host: ReactiveControllerHost,
    frame: (frame: TargetFrame) => void
  ) {
    this.#frame = frame;
    host.addController(this);
  }

  track(
    session: LanternSession
  ): void {
    this.stop();
    this.#session = session;
    this.#since = performance.now();
    this.#gaveUp = false;
    this.#request = requestAnimationFrame(this.#tick);
  }

  stop(): void {
    if (this.#request !== 0) {
      cancelAnimationFrame(this.#request);
    }
    this.#request = 0;
    this.#session = null;
  }

  hostDisconnected(): void {
    this.stop();
  }

  readonly #tick = (
    now: number
  ): void => {
    const session = this.#session;
    if (session === null) {
      return;
    }

    const { target } = session.step;
    const anchor = this.#measure(session, target);
    if (anchor !== null) {
      this.#frame({
        kind: "anchored",
        ...anchor
      });
    }
    else if (target === null || this.#gaveUp) {
      this.#frame({ kind: "centred" });
    }
    else if (now - this.#since >= kRetryMs) {
      this.#giveUp(session, `no target found for ${describe(target)}, the card is centred`);
      this.#frame({ kind: "centred" });
    }
    else {
      this.#frame({ kind: "seeking" });
    }

    this.#request = requestAnimationFrame(this.#tick);
  };

  #giveUp(
    session: LanternSession,
    reason: string
  ): void {
    if (!this.#gaveUp) {
      this.#gaveUp = true;
      session.warn(reason);
    }
  }

  #measure(
    session: LanternSession,
    target: StepTarget | null
  ): TargetAnchor | null {
    if (target === null) {
      return null;
    }

    let resolved: Element | AnchorRect | null = null;
    try {
      resolved = target instanceof TargetPath ?
        target.resolve(session.page) :
        target();
    }
    catch (error) {
      this.#giveUp(session, `target failed, ${String(error)}`);
    }
    if (resolved === null) {
      return null;
    }
    if (!(resolved instanceof Element)) {
      return {
        rect: resolved,
        radii: SQUARE_CORNERS
      };
    }

    const element = resolved instanceof PaneElement ?
      resolved.chromeElement :
      resolved;
    const rect = element.getBoundingClientRect();

    return element.isConnected && (rect.width > 0 || rect.height > 0) ?
      {
        rect,
        radii: cornerRadii(element)
      } :
      null;
  }
}

function cornerRadii(
  element: Element
): CornerRadii {
  const style = getComputedStyle(element);

  return [
    Number.parseFloat(style.borderTopLeftRadius) || 0,
    Number.parseFloat(style.borderTopRightRadius) || 0,
    Number.parseFloat(style.borderBottomRightRadius) || 0,
    Number.parseFloat(style.borderBottomLeftRadius) || 0
  ];
}

function describe(
  target: StepTarget
): string {
  return target instanceof TargetPath ?
    `"${target}"` :
    "the target function";
}
