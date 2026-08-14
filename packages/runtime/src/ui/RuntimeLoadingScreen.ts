// Import Third-party Dependencies
import type {
  AssetLoadProgress,
  AssetRecord
} from "@jolly-pixel/asset";

// Import Internal Dependencies
import { Loading } from "./Loading.ts";

/**
 * Adapts the loading web component to the runtime bootstrap workflow.
 */
export class RuntimeLoadingScreen {
  #canvas: HTMLCanvasElement;
  #loading: Loading;

  private constructor(
    canvas: HTMLCanvasElement,
    loading: Loading
  ) {
    this.#canvas = canvas;
    this.#loading = loading;
  }

  static mount(
    canvas: HTMLCanvasElement,
    container: HTMLElement
  ): RuntimeLoadingScreen {
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity 0.5s ease-in";

    const existing = container.querySelector(
      ":scope > jolly-loading"
    );
    const loading = existing === null
      ? createLoading(container)
      : parseLoading(existing);

    return new RuntimeLoadingScreen(
      canvas,
      loading
    );
  }

  start(): Promise<void> {
    return this.#loading.start();
  }

  update(
    progress: AssetLoadProgress
  ): void {
    this.setAsset(progress.record);
    this.setProgress(
      progress.completed,
      progress.total
    );
  }

  setAsset(
    asset: AssetRecord
  ): void {
    this.#loading.setAsset(asset);
  }

  setProgress(
    completed: number,
    total: number
  ): void {
    this.#loading.setProgress(
      completed,
      total
    );
  }

  async complete(): Promise<void> {
    await this.#loading.complete();
    this.#canvas.style.opacity = "1";
  }

  error(
    error: Error
  ): void {
    this.#loading.error(error);
  }
}

function createLoading(
  container: HTMLElement
): Loading {
  const element = document.createElement("jolly-loading");
  const loading = parseLoading(element);
  container.appendChild(loading);

  return loading;
}

function parseLoading(
  element: Element
): Loading {
  if (!(element instanceof Loading)) {
    throw new TypeError(
      "Expected jolly-loading to be a Loading element."
    );
  }

  return element;
}
