// Import Internal Dependencies
import ThreeSceneManager from "../threeScene.js";
import CanvasManager from "../CanvasManager.js";

export interface ResizerOptions {
  resizerSelector?: string;
  navSelector?: string;
  threeSceneManager: ThreeSceneManager;
  canvasManager: CanvasManager;
}

export class Resizer {
  private resizer: HTMLElement;
  private nav: HTMLElement;
  private threeSceneManager: ThreeSceneManager;
  private canvasManager: CanvasManager;
  private isResizing: boolean = false;

  constructor(options: ResizerOptions) {
    this.resizer = document.querySelector(options.resizerSelector || ".resizer") as HTMLElement;
    this.nav = document.querySelector(options.navSelector || "nav") as HTMLElement;
    this.threeSceneManager = options.threeSceneManager;
    this.canvasManager = options.canvasManager;

    if (!this.resizer || !this.nav) {
      throw new Error("Resizer or nav element not found in DOM");
    }

    this.init();
  }

  private init(): void {
    this.resizer.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    document.addEventListener("pointermove", (e) => this.onPointerMove(e));
    document.addEventListener("pointerup", () => this.onPointerUp());
  }

  private onPointerDown(e: PointerEvent): void {
    this.isResizing = true;
    this.threeSceneManager.setResizing(true);
    document.body.style.cursor = "col-resize";
    this.resizer.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isResizing) {
      return;
    }

    const newWidth = e.clientX;
    this.nav.style.width = `${newWidth}px`;

    this.threeSceneManager.onResize();
    this.canvasManager.onResize();
  }

  private onPointerUp(): void {
    this.isResizing = false;
    this.threeSceneManager.setResizing(false);
    document.body.style.cursor = "default";
  }
}
