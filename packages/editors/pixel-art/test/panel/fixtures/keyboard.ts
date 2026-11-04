// Import Third-party Dependencies
import type { CanvasShortcuts } from "@jolly-pixel/pixel-draw.renderer";
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

export class FakeShortcuts implements CanvasShortcuts {
  readonly calls: string[] = [];
  handles = true;
  panHeld = false;
  lineHeld = false;
  snapBypassHeld = false;

  #record(
    name: string
  ): boolean {
    this.calls.push(name);

    return this.handles;
  }

  selectAll() {
    return this.#record("selectAll");
  }

  copy() {
    return this.#record("copy");
  }

  paste() {
    return this.#record("paste");
  }

  delete() {
    return this.#record("delete");
  }

  undo() {
    return this.#record("undo");
  }

  redo() {
    return this.#record("redo");
  }

  rotate(
    direction: "cw" | "ccw"
  ) {
    return this.#record(`rotate:${direction}`);
  }

  flipHorizontal() {
    return this.#record("flipHorizontal");
  }

  flipVertical() {
    return this.#record("flipVertical");
  }
}

export class StubHost extends EventTarget implements ReactiveControllerHost {
  readonly controllers: ReactiveController[] = [];
  readonly updateComplete = Promise.resolve(true);

  addController(
    controller: ReactiveController
  ): void {
    this.controllers.push(controller);
  }

  removeController(): void {
    return undefined;
  }

  requestUpdate(): void {
    return undefined;
  }
}

export function press(
  type: "keydown" | "keyup",
  init: KeyboardEventInit,
  target: EventTarget = document
): KeyboardEvent {
  const event = new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    ...init
  });
  target.dispatchEvent(event);

  return event;
}
