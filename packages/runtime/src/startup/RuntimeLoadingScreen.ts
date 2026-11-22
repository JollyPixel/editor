// Import Third-party Dependencies
import type {
  AssetPath,
  AssetRecord
} from "@jolly-pixel/asset";
import { Loading } from "@jolly-pixel/ui/elements/loading";
import { delay } from "@jolly-pixel/utils";

// CONSTANTS
const kSkippedLoadingScreen: LoadingScreen = {
  start: () => Promise.resolve(),
  progress: () => undefined,
  complete: () => Promise.resolve(),
  error: () => undefined
};

export interface LoadingProgress {
  readonly completed: number;
  readonly total: number;
}

export interface LoadingScreen {
  start(): Promise<void>;
  progress(
    progress: LoadingProgress,
    asset: AssetRecord | null
  ): void;
  complete(): Promise<void>;
  error(
    error: Error
  ): void;
}

export class RuntimeLoadingScreen implements LoadingScreen {
  #canvas: HTMLCanvasElement;
  #loading: Loading;
  #minimumDelay: number;

  private constructor(
    canvas: HTMLCanvasElement,
    loading: Loading,
    minimumDelay: number
  ) {
    this.#canvas = canvas;
    this.#loading = loading;
    this.#minimumDelay = minimumDelay;
  }

  static mount(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    minimumDelay: number
  ): RuntimeLoadingScreen {
    canvas.style.opacity = "0";
    canvas.style.transition = "opacity 0.5s ease-in";

    const existing = container.querySelector(
      ":scope > jolly-loading"
    );
    const loading = existing === null
      ? createLoading(container)
      : assertLoading(existing);

    return new RuntimeLoadingScreen(
      canvas,
      loading,
      minimumDelay
    );
  }

  static skip(
    canvas: HTMLCanvasElement
  ): LoadingScreen {
    canvas.style.opacity = "1";

    return kSkippedLoadingScreen;
  }

  async start(): Promise<void> {
    await Promise.all([
      this.#loading.start(),
      delay(this.#minimumDelay)
    ]);
  }

  progress(
    progress: LoadingProgress,
    asset: AssetRecord | null
  ): void {
    if (asset !== null) {
      this.#loading.showAsset(fileName(asset.path));
    }
    this.#loading.updateProgress(
      progress.completed,
      progress.total
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

function fileName(
  path: AssetPath
): string {
  const name = `${path.name}${path.extension}`;
  try {
    return decodeURIComponent(name);
  }
  catch {
    return name;
  }
}

function createLoading(
  container: HTMLElement
): Loading {
  const element = document.createElement("jolly-loading");
  const loading = assertLoading(element);
  container.appendChild(loading);

  return loading;
}

function assertLoading(
  element: Element
): Loading {
  if (!(element instanceof Loading)) {
    throw new TypeError(
      "Expected jolly-loading to be a Loading element."
    );
  }

  return element;
}
