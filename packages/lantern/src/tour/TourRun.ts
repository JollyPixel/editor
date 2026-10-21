// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { UnknownStepError } from "./errors/UnknownStepError.ts";
import {
  TargetSeek,
  type TargetFrame,
  type TargetMeasure
} from "./TargetSeek.ts";
import type { Tour } from "./Tour.ts";
import { TourKeys } from "./TourKeys.ts";
import type {
  StepCleanup,
  TourStep
} from "./TourStep.ts";

export type RunOutcome = "finished" | "skipped" | "interrupted";
export type RunState = "running" | RunOutcome;

export type TourRunEvents = {
  step: (step: TourStep) => void;
  end: (outcome: RunOutcome, followUp: Tour | null) => void;
};

export interface TourRunOptions {
  /**
   * Id of the first step shown.
   */
  at?: string;
  /**
   * @default document
   */
  page?: Document;
  /**
   * @default console.warn
   */
  warn?: (message: string) => void;
  /**
   * Resolves the `{namespace.action}` key spans of step bodies.
   * @default new TourKeys()
   */
  keys?: TourKeys;
}

export class TourRun extends Emitter<TourRunEvents> {
  readonly tour: Tour;
  readonly keys: TourKeys;

  #page: Document;
  #warn: (message: string) => void;
  #index: number;
  #state: RunState = "running";
  #step: AbortController | null = null;
  #seek: TargetSeek | null = null;
  #cleanup: StepCleanup | null = null;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    tour: Tour,
    options: TourRunOptions = {}
  ) {
    super();

    const {
      at,
      page = document,
      warn = (message) => console.warn(message),
      keys = new TourKeys()
    } = options;
    const index = at === undefined ? 0 : tour.stepIndex(at);
    if (index === -1) {
      throw new UnknownStepError(
        tour.id, at ?? ""
      );
    }

    this.tour = tour;
    this.keys = keys;
    this.#page = page;
    this.#warn = warn;
    this.#index = index;
    void this.#enqueue(() => this.#show(index));
  }

  get index(): number {
    return this.#index;
  }

  get step(): TourStep {
    return this.tour.steps[this.#index];
  }

  get state(): RunState {
    return this.#state;
  }

  get waiting(): boolean {
    return this.step.until !== null;
  }

  get first(): boolean {
    return this.#index === 0;
  }

  get last(): boolean {
    return this.#index === this.tour.steps.length - 1;
  }

  get offeredFollowUp(): Tour | null {
    return this.last && !this.waiting ? this.tour.followUp : null;
  }

  next(): Promise<void> {
    return this.#enqueue(async() => {
      if (this.#state !== "running") {
        return;
      }

      this.#leave();
      if (this.last) {
        this.#finish(null);

        return;
      }
      await this.#show(this.#index + 1);
    });
  }

  startFollowUp(): Promise<void> {
    return this.#enqueue(async() => {
      const followUp = this.offeredFollowUp;
      if (this.#state !== "running" || followUp === null) {
        return;
      }

      this.#leave();
      this.#finish(followUp);
    });
  }

  back(): Promise<void> {
    return this.#enqueue(async() => {
      if (this.#state !== "running" || this.first) {
        return;
      }

      this.#leave();
      await this.#show(this.#index - 1);
    });
  }

  skip(): void {
    this.#stop("skipped");
  }

  interrupt(): void {
    this.#stop("interrupted");
  }

  seek<TAnchor>(
    now: number,
    measure: TargetMeasure<TAnchor>
  ): TargetFrame<TAnchor> {
    return this.#seek?.frame(now, measure) ?? { kind: "seeking" };
  }

  #stop(
    outcome: "skipped" | "interrupted"
  ): void {
    if (this.#state !== "running") {
      return;
    }

    this.#state = outcome;
    this.#step?.abort();
    void this.#enqueue(async() => {
      this.#leave();
      this.emit("end", outcome, null);
    });
  }

  #enqueue(
    operation: () => Promise<void>
  ): Promise<void> {
    const run = this.#queue.then(operation);
    this.#queue = run.catch(() => undefined);

    return run;
  }

  async #show(
    index: number
  ): Promise<void> {
    if (this.#state !== "running") {
      return;
    }

    const controller = new AbortController();
    const step = this.tour.steps[index];
    const context = {
      page: this.#page,
      signal: controller.signal
    };
    this.#step = controller;
    this.#index = index;
    this.#seek = new TargetSeek({
      target: step.target,
      page: this.#page,
      warn: (message) => this.#warnStep(step, message)
    });

    try {
      const cleanup = await step.enter?.(context);
      this.#cleanup = typeof cleanup === "function" ? cleanup : null;
    }
    catch (error) {
      if (!controller.signal.aborted) {
        this.#report(step, "enter", error);
      }
    }

    if (this.#state !== "running") {
      return;
    }

    this.emit("step", step);
    if (step.until !== null) {
      step.until(context).then(
        () => this.#advance(controller.signal),
        (error: unknown) => {
          if (!controller.signal.aborted) {
            this.#report(step, "until", error);
          }
          this.#advance(controller.signal);
        }
      );
    }
  }

  #advance(
    signal: AbortSignal
  ): void {
    if (!signal.aborted) {
      void this.next();
    }
  }

  #leave(): void {
    const step = this.step;
    const cleanup = this.#cleanup;
    this.#step?.abort();
    this.#step = null;
    this.#cleanup = null;

    try {
      cleanup?.();
    }
    catch (error) {
      this.#report(step, "cleanup", error);
    }
  }

  #finish(
    followUp: Tour | null
  ): void {
    this.#state = "finished";
    this.emit("end", "finished", followUp);
  }

  #report(
    step: TourStep,
    hook: "enter" | "until" | "cleanup",
    error: unknown
  ): void {
    const reason = error instanceof Error
      ? error.message
      : String(error);
    this.#warnStep(step, `${hook} failed, ${reason}`);
  }

  #warnStep(
    step: TourStep,
    message: string
  ): void {
    this.#warn(`Tour "${this.tour.id}" step "${step.id}": ${message}`);
  }
}
