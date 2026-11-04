// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

export class FrameUpdateController implements ReactiveController {
  #host: ReactiveControllerHost;
  #frame: number | null = null;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    host.addController(this);
  }

  schedule(): void {
    this.#frame ??= requestAnimationFrame(() => {
      this.#frame = null;
      this.#host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    if (this.#frame !== null) {
      cancelAnimationFrame(this.#frame);
      this.#frame = null;
    }
  }
}
