// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

// Import Internal Dependencies
import type { StepDirection } from "../../numeric/entry.ts";
import type { ModifierKeys } from "../../numeric/modifierMultiplier.ts";
import {
  startPointerDragSession,
  type PointerDragSessionHandle
} from "../pointer/PointerDragSession.ts";

// CONSTANTS
const kRepeatDelayMs = 400;
const kRepeatIntervalMs = 60;

export interface StepperOptions {
  start(): number | undefined;
  next(
    value: number,
    direction: StepDirection,
    modifiers: ModifierKeys
  ): number;
  onInput(
    value: number
  ): void;
  onCommit(
    value: number
  ): void;
}

export class StepperController implements ReactiveController {
  #options: StepperOptions;
  #session: PointerDragSessionHandle | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: StepperOptions
  ) {
    this.#options = options;
    host.addController(this);
  }

  get dragging(): boolean {
    return this.#session !== null;
  }

  hostDisconnected(): void {
    this.#session?.cancel();
  }

  onIncrementPress = (
    event: PointerEvent
  ): void => {
    this.#press(event, 1);
  };

  onDecrementPress = (
    event: PointerEvent
  ): void => {
    this.#press(event, -1);
  };

  #press(
    event: PointerEvent,
    direction: StepDirection
  ): void {
    const element = event.currentTarget;
    const origin = this.#options.start();
    if (
      event.button !== 0 ||
      this.dragging ||
      origin === undefined ||
      !(element instanceof HTMLElement)
    ) {
      return;
    }

    event.preventDefault();
    let current = origin;
    let repeat: ReturnType<typeof setInterval> | undefined;

    const step = (): void => {
      const next = this.#options.next(current, direction, event);
      if (next !== current) {
        current = next;
        this.#options.onInput(current);
      }
    };
    const delay = setTimeout(() => {
      repeat = setInterval(step, kRepeatIntervalMs);
    }, kRepeatDelayMs);

    this.#session = startPointerDragSession({
      element,
      event,
      onMove: () => undefined,
      onFinish: (result) => {
        clearTimeout(delay);
        clearInterval(repeat);
        this.#session = null;
        if (current === origin) {
          return;
        }

        if (result === "commit") {
          this.#options.onCommit(current);
        }
        else {
          this.#options.onInput(origin);
        }
      }
    });
    step();
  }
}
