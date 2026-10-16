// Import Internal Dependencies
import type { PreviewStage } from "./PreviewStage.ts";

export class Turntable {
  readonly canvas: HTMLCanvasElement;

  protected readonly container: HTMLElement;
  protected readonly stage: PreviewStage;
  protected readonly context: CanvasRenderingContext2D | null;
  readonly #resizeObserver: ResizeObserver;
  readonly #visibilityObserver: IntersectionObserver;
  #raf = -1;
  #visible = false;

  constructor(
    container: HTMLElement,
    stage: PreviewStage
  ) {
    this.container = container;
    this.stage = stage;

    this.canvas = document.createElement("canvas");
    this.canvas.style.display = "block";
    this.context = this.canvas.getContext("2d");
    container.appendChild(this.canvas);

    this.#resizeObserver = new ResizeObserver(() => this.resized());
    this.#resizeObserver.observe(container);
    this.#visibilityObserver = new IntersectionObserver(this.#onVisibility);
    this.#visibilityObserver.observe(container);
  }

  dispose(): void {
    cancelAnimationFrame(this.#raf);
    this.#resizeObserver.disconnect();
    this.#visibilityObserver.disconnect();
    this.canvas.remove();
  }

  protected resized(): void {
    return void 0;
  }

  protected refresh(
    _time: number
  ): void {
    return void 0;
  }

  protected draw(): void {
    return void 0;
  }

  readonly #onVisibility = (
    entries: IntersectionObserverEntry[]
  ): void => {
    const visible = entries.at(-1)?.isIntersecting === true;
    if (visible === this.#visible) {
      return;
    }

    this.#visible = visible;
    cancelAnimationFrame(this.#raf);
    this.#raf = visible ? requestAnimationFrame(this.#loop) : -1;
  };

  readonly #loop = (time: number): void => {
    this.#raf = requestAnimationFrame(this.#loop);
    this.refresh(time);
    this.draw();
  };
}
