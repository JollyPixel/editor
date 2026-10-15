// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { UnknownStepError } from "../tour/errors/UnknownStepError.ts";
import type { Tour } from "../tour/Tour.ts";
import type {
  StepCleanup,
  TourStep
} from "../tour/TourStep.ts";

export type SessionOutcome = "finished" | "skipped";
export type SessionState = "running" | SessionOutcome;

export type LanternSessionEvents = {
  step: (step: TourStep) => void;
  end: (outcome: SessionOutcome, followUp: Tour | null) => void;
};

export interface LanternSessionOptions {
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
}

export class LanternSession extends Emitter<LanternSessionEvents> {
  readonly tour: Tour;
  readonly page: Document;

  #warn: (message: string) => void;
  #index: number;
  #state: SessionState = "running";
  #step: AbortController | null = null;
  #cleanup: StepCleanup | null = null;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    tour: Tour,
    options: LanternSessionOptions = {}
  ) {
    super();

    const {
      at,
      page = document,
      warn = (message) => console.warn(message)
    } = options;
    const index = at === undefined ? 0 : tour.stepIndex(at);
    if (index === -1) {
      throw new UnknownStepError(
        tour.id, at ?? ""
      );
    }

    this.tour = tour;
    this.page = page;
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

  get state(): SessionState {
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

  warn(
    message: string
  ): void {
    this.#warn(`Tour "${this.tour.id}" step "${this.step.id}": ${message}`);
  }

  skip(): void {
    if (this.#state !== "running") {
      return;
    }

    this.#state = "skipped";
    this.#step?.abort();
    void this.#enqueue(async() => {
      this.#leave();
      this.emit("end", "skipped", null);
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
      page: this.page,
      signal: controller.signal
    };
    this.#step = controller;
    this.#index = index;

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
    this.#warn(
      `Tour "${this.tour.id}" step "${step.id}": ${hook} failed, ${reason}`
    );
  }
}
