// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

export interface ControllerHost extends ReactiveControllerHost {
  readonly controllers: ReactiveController[];
  updates: number;
}

export function createControllerHost(): ControllerHost {
  const host: ControllerHost = {
    controllers: [],
    updates: 0,
    updateComplete: Promise.resolve(true),
    addController: (controller) => {
      host.controllers.push(controller);
    },
    removeController: () => undefined,
    requestUpdate: () => {
      host.updates++;
    }
  };

  return host;
}
