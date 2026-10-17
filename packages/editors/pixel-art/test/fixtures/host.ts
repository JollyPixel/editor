// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";

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
