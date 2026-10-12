// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";

export class TreeHairlineController implements ReactiveController {
  readonly #host: ReactiveControllerHost & HTMLElement;
  #query: MediaQueryList | null = null;

  constructor(
    host: ReactiveControllerHost & HTMLElement
  ) {
    this.#host = host;
    host.addController(this);
  }

  hostConnected(): void {
    this.#measure();
  }

  hostDisconnected(): void {
    this.#query?.removeEventListener("change", this.#measure);
    this.#query = null;
  }

  readonly #measure = (): void => {
    this.#query?.removeEventListener("change", this.#measure);

    const view = this.#host.ownerDocument.defaultView;
    const ratio = view?.devicePixelRatio || 1;
    this.#host.style.setProperty("--jolly-tree-hairline", `${1 / ratio}px`);
    this.#query = view?.matchMedia(`(resolution: ${ratio}dppx)`) ?? null;
    this.#query?.addEventListener("change", this.#measure);
  };
}
