// Import Internal Dependencies
import type { ControlTarget } from "../ControlTarget.js";

export class Fullscreen extends EventTarget implements ControlTarget {
  #canvas: HTMLCanvasElement;

  wantsFullscreen = false;
  wasFullscreen = false;

  constructor(
    canvas: HTMLCanvasElement
  ) {
    super();
    this.#canvas = canvas;
  }

  connect() {
    document.addEventListener("fullscreenchange", this.onFullscreenChange, false);
    document.addEventListener("fullscreenerror", this.onFullscreenError, false);
  }

  disconnect() {
    document.removeEventListener("fullscreenchange", this.onFullscreenChange, false);
    document.removeEventListener("fullscreenerror", this.onFullscreenError, false);
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
    if (document.fullscreenElement === this.#canvas) {
      document.exitFullscreen();
    }
  }

  private onFullscreenChange = () => {
    const isFullscreen = document.fullscreenElement === this.#canvas;
    if (this.wasFullscreen !== isFullscreen) {
      this.dispatchEvent(new CustomEvent("stateChange", {
        detail: isFullscreen ? "active" : "suspended"
      }));
      this.wasFullscreen = isFullscreen;
    }
  };

  private onFullscreenError = () => {
    if (this.wasFullscreen) {
      this.dispatchEvent(new CustomEvent("stateChange", {
        detail: "suspended"
      }));
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
