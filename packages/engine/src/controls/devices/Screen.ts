// Import Third-party Dependencies
import { EventEmitter } from "@posva/event-emitter";

// Import Internal Dependencies
import {
  BrowserDocumentAdapter,
  type DocumentAdapter,
  type CanvasAdapter
} from "../../adapters/index.js";
import type { InputConnectable } from "../types.js";

export type FullscreenState = "active" | "suspended";

export type ScreenEvents = {
  stateChange: [FullscreenState];
};

export interface ScreenOptions {
  canvas: CanvasAdapter;
  documentAdapter?: DocumentAdapter;
}

export class Screen extends EventEmitter<
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
      this.onFullscreenChange,
      false
    );
    this.#documentAdapter.addEventListener(
      "fullscreenerror",
      this.onFullscreenError,
      false
    );
  }

  disconnect() {
    this.#documentAdapter.removeEventListener(
      "fullscreenchange",
      this.onFullscreenChange,
      false
    );
    this.#documentAdapter.removeEventListener(
      "fullscreenerror",
      this.onFullscreenError,
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

  exit() {
    this.reset();
    if (this.#documentAdapter.fullscreenElement === (this.#canvas as any)) {
      this.#documentAdapter.exitFullscreen();
    }
  }

  private onFullscreenChange = () => {
    const isFullscreen = this.#documentAdapter.fullscreenElement === (this.#canvas as any);
    if (this.wasFullscreen !== isFullscreen) {
      this.emit("stateChange", isFullscreen ? "active" : "suspended");
      this.wasFullscreen = isFullscreen;
    }
  };

  private onFullscreenError = () => {
    if (this.wasFullscreen) {
      this.emit("stateChange", "suspended");
      this.wasFullscreen = false;
    }
  };

  onMouseDown = () => {
    if (this.wantsFullscreen && !this.wasFullscreen) {
      this.#canvas.requestFullscreen();
    }
  };

  onMouseUp = () => {
    if (this.wantsFullscreen && !this.wasFullscreen) {
      this.#canvas.requestFullscreen();
    }
  };
}
