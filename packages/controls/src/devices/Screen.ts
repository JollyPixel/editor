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

  getSize(): Vector2Like {
    return {
      x: this.#canvas.clientWidth,
      y: this.#canvas.clientHeight
    };
  }

  getBounds() {
    const size = this.getSize();

    return {
      left: size.x / -2,
      right: size.x / 2,
      top: size.y / 2,
      bottom: size.y / -2
    };
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
