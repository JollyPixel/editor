// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import {
  inputLayers,
  originatesInButton
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { TourRun } from "../tour/TourRun.ts";

// CONSTANTS
const kStepKeys = new Map<string, StepAction>([
  ["ArrowRight", (run) => void run.next()],
  ["Enter", (run) => void run.next()],
  ["ArrowLeft", (run) => void run.back()],
  ["Escape", (run) => run.skip()]
]);

type StepAction = (run: TourRun) => void;

export class StepInput implements ReactiveController {
  #host: ReactiveControllerHost & Element;
  #run: TourRun | null = null;
  #held: AbortController | null = null;

  constructor(
    host: ReactiveControllerHost & Element
  ) {
    this.#host = host;
    host.addController(this);
  }

  follow(
    run: TourRun
  ): void {
    if (run.waiting) {
      this.release();

      return;
    }
    if (this.#held !== null && this.#run === run) {
      return;
    }

    this.release();
    this.#hold(run);
  }

  release(): void {
    this.#held?.abort();
    this.#held = null;
    this.#run = null;
  }

  hostDisconnected(): void {
    this.release();
  }

  #hold(
    run: TourRun
  ): void {
    const held = new AbortController();
    const releaseLayer = inputLayers.push({
      dismiss: () => {
        run.skip();

        return true;
      }
    });
    held.signal.addEventListener("abort", releaseLayer, { once: true });
    this.#held = held;
    this.#run = run;

    const since = performance.now();
    this.#host.ownerDocument.defaultView?.addEventListener("keydown", (event) => {
      const action = StepInput.#action(event);
      if (
        action === null ||
        event.timeStamp < since ||
        (event.key === "Enter" && originatesInButton(event.composedPath()[0]))
      ) {
        return;
      }

      event.preventDefault();
      action(run);
    }, { signal: held.signal });
  }

  static #action(
    event: KeyboardEvent
  ): StepAction | null {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return null;
    }

    return kStepKeys.get(event.key) ?? null;
  }
}
