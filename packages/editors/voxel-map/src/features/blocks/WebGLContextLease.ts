// CONSTANTS
const kContextLostEvent = "webglcontextlost";

export interface LeasedWebGLRenderer {
  domElement: EventTarget;
  forceContextLoss(): void;
  dispose(): void;
}

export class WebGLContextLease {
  onLost: (() => void) | null = null;

  #renderer: LeasedWebGLRenderer;
  #released = false;

  constructor(
    renderer: LeasedWebGLRenderer
  ) {
    this.#renderer = renderer;
    renderer.domElement.addEventListener(kContextLostEvent, this.#handleLost);
  }

  release(): void {
    if (this.#released) {
      return;
    }

    this.#released = true;
    this.#renderer.domElement.removeEventListener(
      kContextLostEvent,
      this.#handleLost
    );
    this.#renderer.forceContextLoss();
    this.#renderer.dispose();
  }

  readonly #handleLost = (): void => {
    this.onLost?.();
  };
}
