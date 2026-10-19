// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

export type ElementHost = HTMLElement & ReactiveControllerHost & {
  updateCount: number;
  connect(): void;
};

export function createElementHost(): ElementHost {
  const controllers: ReactiveController[] = [];

  return Object.assign(document.createElement("div"), {
    updateComplete: Promise.resolve(true),
    updateCount: 0,
    addController(controller: ReactiveController): void {
      controllers.push(controller);
    },
    removeController(_controller: ReactiveController): void {
      void _controller;
    },
    requestUpdate(): void {
      this.updateCount++;
    },
    connect(): void {
      for (const controller of controllers) {
        controller.hostConnected?.();
      }
    }
  });
}

export class TestHost implements ReactiveControllerHost {
  readonly updateComplete = Promise.resolve(true);
  readonly renderRoot = document.createElement("div");
  updateCount = 0;

  addController(): void {
    return undefined;
  }

  removeController(): void {
    return undefined;
  }

  requestUpdate(): void {
    this.updateCount++;
  }
}
