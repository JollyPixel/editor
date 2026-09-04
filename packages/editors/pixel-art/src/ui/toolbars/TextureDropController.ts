// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { decodeRasterCanvas } from "@jolly-pixel/image/raster";

// Import Internal Dependencies
import { renderIcon } from "../common/icons.ts";
import { TransientStatus } from "./TransientStatus.ts";
import {
  hasSupportedImageDrag,
  isDirectoryItem,
  isSupportedFile,
  pointInTextureBounds,
  textureDropBounds,
  type TextureDropBounds
} from "./textureDropGeometry.ts";

export class TextureDropController implements ReactiveController {
  #host: ReactiveControllerHost;
  #canvas: PixelArtCanvas | null = null;
  #stage: HTMLElement | null = null;
  #bounds: TextureDropBounds | null = null;
  readonly #status: TransientStatus;
  #dropGeneration = 0;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    this.#status = new TransientStatus(host);
    host.addController(this);
  }

  hostDisconnected(): void {
    this.detach();
  }

  attach(
    canvas: PixelArtCanvas,
    stage: HTMLElement
  ): void {
    this.detach();
    this.#canvas = canvas;
    this.#stage = stage;
    stage.addEventListener("dragenter", this.#onDragOver);
    stage.addEventListener("dragover", this.#onDragOver);
    stage.addEventListener("dragleave", this.#onDragLeave);
    stage.addEventListener("drop", this.#onDrop);
    window.addEventListener("blur", this.#onDragEnd);
    window.addEventListener("dragend", this.#onDragEnd);
  }

  detach(): void {
    this.#dropGeneration++;
    this.#stage?.removeEventListener("dragenter", this.#onDragOver);
    this.#stage?.removeEventListener("dragover", this.#onDragOver);
    this.#stage?.removeEventListener("dragleave", this.#onDragLeave);
    this.#stage?.removeEventListener("drop", this.#onDrop);
    window.removeEventListener("blur", this.#onDragEnd);
    window.removeEventListener("dragend", this.#onDragEnd);
    this.#canvas = null;
    this.#stage = null;
    this.#clearOverlay();
    this.#status.clear();
  }

  readonly #onDragOver = (
    event: DragEvent
  ): void => {
    if (
      !this.#canvas ||
      !this.#stage ||
      !this.#hasFilePayload(event.dataTransfer) ||
      this.#isInteractiveTarget(event)
    ) {
      this.#clearOverlay();

      return;
    }

    const bounds = textureDropBounds(this.#canvas, this.#stage);
    if (!pointInTextureBounds(event.clientX, event.clientY, bounds, this.#stage)) {
      this.#clearOverlay();

      return;
    }

    event.preventDefault();
    if (!hasSupportedImageDrag(event.dataTransfer)) {
      this.#clearOverlay();

      return;
    }

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    this.#bounds = bounds;
    this.#host.requestUpdate();
  };

  readonly #onDragLeave = (
    event: DragEvent
  ): void => {
    const nextTarget = event.relatedTarget;
    if (!this.#stage || !(nextTarget instanceof Node) || !this.#stage.contains(nextTarget)) {
      this.#clearOverlay();
    }
  };

  readonly #onDrop = (
    event: DragEvent
  ): void => {
    const canvas = this.#canvas;
    const stage = this.#stage;
    const file = this.#validDropFile(event.dataTransfer);
    const generation = ++this.#dropGeneration;
    const bounds = canvas && stage ? textureDropBounds(canvas, stage) : null;
    const isInside = bounds && stage ?
      pointInTextureBounds(event.clientX, event.clientY, bounds, stage) :
      false;
    this.#clearOverlay();

    if (!canvas || !stage || !isInside || this.#isInteractiveTarget(event)) {
      return;
    }

    event.preventDefault();
    if (!file) {
      this.#status.set(this.#dropValidationMessage(event.dataTransfer));

      return;
    }

    void this.#replaceTexture(file, generation);
  };

  readonly #onDragEnd = (): void => {
    this.#clearOverlay();
  };

  #validDropFile(
    dataTransfer: DataTransfer | null
  ): File | null {
    if (!dataTransfer || dataTransfer.files.length !== 1) {
      return null;
    }
    if ([...dataTransfer.items].some(isDirectoryItem)) {
      return null;
    }

    const file = dataTransfer.files[0];

    return isSupportedFile(file) ? file : null;
  }

  #hasFilePayload(
    dataTransfer: DataTransfer | null
  ): boolean {
    return dataTransfer !== null && (
      dataTransfer.files.length > 0 ||
      [...dataTransfer.types].includes("Files")
    );
  }

  #dropValidationMessage(
    dataTransfer: DataTransfer | null
  ): string {
    if (!dataTransfer || dataTransfer.files.length !== 1) {
      return "Drop one image file";
    }

    return "Unsupported image format";
  }

  #isInteractiveTarget(
    event: DragEvent
  ): boolean {
    const target = event.composedPath()[0];

    return target instanceof Element &&
      target.closest(".overlay-toolbar, .tool-option-overlay") !== null;
  }

  async #replaceTexture(
    file: File,
    generation: number
  ): Promise<void> {
    const canvas = this.#canvas;
    if (!canvas) {
      return;
    }

    let source: HTMLCanvasElement;
    try {
      source = await decodeRasterCanvas(file);
    }
    catch {
      if (generation !== this.#dropGeneration) {
        return;
      }
      this.#status.set("Could not decode the image");

      return;
    }
    if (
      generation !== this.#dropGeneration ||
      this.#canvas !== canvas
    ) {
      return;
    }
    if (source.width <= 0 || source.height <= 0) {
      this.#status.set("Could not decode the image");

      return;
    }
    if (
      source.width > canvas.maxTextureSize ||
      source.height > canvas.maxTextureSize
    ) {
      this.#status.set(
        `Image exceeds the maximum texture size of ${canvas.maxTextureSize}×${canvas.maxTextureSize}`
      );

      return;
    }

    canvas.texture = source;
    canvas.centerTexture();
    this.#status.set("Texture replaced");
  }

  #clearOverlay(): void {
    if (!this.#bounds) {
      return;
    }

    this.#bounds = null;
    this.#host.requestUpdate();
  }

  render() {
    const overlay = this.#bounds ? html`
      <div
        class="texture-drop-overlay"
        part="texture-drop-overlay"
        style=${`
          left: ${this.#bounds.left}px;
          top: ${this.#bounds.top}px;
          width: ${this.#bounds.width}px;
          height: ${this.#bounds.height}px;
        `}
      >
        ${renderIcon("import")}
        <span>Drop image to replace texture</span>
      </div>
    ` : nothing;

    return html`
      ${overlay}
      <div
        class="drop-status"
        part="drop-status"
        aria-live="polite"
        aria-atomic="true"
      >${this.#status.value}</div>
    `;
  }
}
