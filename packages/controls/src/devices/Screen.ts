// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import {
  BrowserDocumentAdapter,
  type DocumentAdapter,
  type CanvasAdapter
} from "./../adapters/index.ts";
import type {
  InputConnectable,
  Vector2Like
} from "../types.ts";

export interface ScreenBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export type FullscreenState =
  | "active"
  | "suspended";

export type ScreenEvents = {
  stateChange: (
    fullScreenState: FullscreenState
  ) => void;
};

export interface ScreenOptions {
  canvas: CanvasAdapter;
  documentAdapter?: DocumentAdapter;
}

export class Screen extends Emitter<
  ScreenEvents
> implements InputConnectable {
  #canvas: CanvasAdapter;
  #documentAdapter: DocumentAdapter;

  wantsFullscreen = false;
  wasFullscreen = false;

  constructor(
    options: ScreenOptions
  ) {
    super();
    const {
      canvas,
      documentAdapter = new BrowserDocumentAdapter()
    } = options;

    this.#canvas = canvas;
    this.#documentAdapter = documentAdapter;
  }

  connect() {
    this.#documentAdapter.addEventListener(
      "fullscreenchange",
      this.#onFullscreenChange,
      false
    );
    this.#documentAdapter.addEventListener(
      "fullscreenerror",
      this.#onFullscreenError,
      false
    );
  }

  disconnect() {
    this.#documentAdapter.removeEventListener(
      "fullscreenchange",
      this.#onFullscreenChange,
      false
    );
    this.#documentAdapter.removeEventListener(
      "fullscreenerror",
      this.#onFullscreenError,
      false
    );
  }

  reset() {
    this.wantsFullscreen = false;
    this.wasFullscreen = false;
  }

  enter() {
    this.wantsFullscreen = true;
  }

  get size(): Vector2Like {
    return this.sizeTo({
      x: 0,
      y: 0
    });
  }

  sizeTo<T extends Vector2Like>(
    out: T
  ): T {
    out.x = this.#canvas.clientWidth;
    out.y = this.#canvas.clientHeight;

    return out;
  }

  get bounds(): ScreenBounds {
    return this.boundsTo({
      left: 0,
      right: 0,
      top: 0,
      bottom: 0
    });
  }

  boundsTo<T extends ScreenBounds>(
    out: T
  ): T {
    const width = this.#canvas.clientWidth;
    const height = this.#canvas.clientHeight;

    out.left = width / -2;
    out.right = width / 2;
    out.top = height / 2;
    out.bottom = height / -2;

    return out;
  }

  exit() {
    this.reset();

    const { fullscreenElement } = this.#documentAdapter;
    if (fullscreenElement === this.#canvas) {
      this.#documentAdapter.exitFullscreen();
    }
  }

  #onFullscreenChange = () => {
    const { fullscreenElement } = this.#documentAdapter;

    const isFullscreen = fullscreenElement === this.#canvas;
    if (this.wasFullscreen !== isFullscreen) {
      this.emit(
        "stateChange",
        isFullscreen ? "active" : "suspended"
      );
      this.wasFullscreen = isFullscreen;
    }
  };

  #onFullscreenError = () => {
    if (this.wasFullscreen) {
      this.emit(
        "stateChange",
        "suspended"
      );
      this.wasFullscreen = false;
    }
  };

  requestFullscreenIfWanted = () => {
    if (
      this.wantsFullscreen &&
      !this.wasFullscreen
    ) {
      this.#canvas.requestFullscreen();
    }
  };
}
