// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import {
  decodeRasterCanvas,
  type PixelArtCanvas
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { renderIcon } from "../common/icons.ts";

// CONSTANTS
const kSupportedTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif"
]);
const kSupportedExtensions = new Set([
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif"
]);
const kStatusTimeoutMs = 3_000;

export interface TextureDropBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface FileSystemEntryLike {
  isDirectory: boolean;
}

function isDirectoryItem(
  item: DataTransferItem
): boolean {
  const itemWithEntry = item as DataTransferItem & {
    webkitGetAsEntry?: () => FileSystemEntryLike | null;
  };

  return itemWithEntry.webkitGetAsEntry?.()?.isDirectory === true;
}

function isSupportedFile(
  file: File
): boolean {
  if (kSupportedTypes.has(file.type.toLowerCase())) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  return file.type === "" && extension !== undefined && kSupportedExtensions.has(extension);
}

export function hasSupportedImageDrag(
  dataTransfer: DataTransfer | null
): boolean {
  if (!dataTransfer || [...dataTransfer.types].includes("text/uri-list")) {
    return false;
  }

  const fileItems = [...dataTransfer.items].filter((item) => item.kind === "file");
  if (fileItems.length > 0) {
    return fileItems.length === 1 &&
      !isDirectoryItem(fileItems[0]) &&
      kSupportedTypes.has(fileItems[0].type.toLowerCase());
  }

  return dataTransfer.files.length === 1 &&
    isSupportedFile(dataTransfer.files[0]);
}

export function textureDropBounds(
  canvas: PixelArtCanvas,
  stage: HTMLElement
): TextureDropBounds {
  const canvasBounds = canvas.canvas().getBoundingClientRect();
  const stageBounds = stage.getBoundingClientRect();
  const { camera, zoom, textureSize } = canvas;

  return {
    left: canvasBounds.left - stageBounds.left + camera.x,
    top: canvasBounds.top - stageBounds.top + camera.y,
    width: textureSize.x * zoom.value,
    height: textureSize.y * zoom.value
  };
}

export function pointInTextureBounds(
  clientX: number,
  clientY: number,
  bounds: TextureDropBounds,
  stage: HTMLElement
): boolean {
  const stageBounds = stage.getBoundingClientRect();
  const x = clientX - stageBounds.left;
  const y = clientY - stageBounds.top;

  return x >= bounds.left &&
    x < bounds.left + bounds.width &&
    y >= bounds.top &&
    y < bounds.top + bounds.height;
}

export class TextureDropController implements ReactiveController {
  #host: ReactiveControllerHost;
  #canvas: PixelArtCanvas | null = null;
  #stage: HTMLElement | null = null;
  #bounds: TextureDropBounds | null = null;
  #status = "";
  #statusTimer: number | null = null;
  #dropGeneration = 0;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
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
    this.#clearStatus();
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
      this.#setStatus(this.#dropValidationMessage(event.dataTransfer));

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
      this.#setStatus("Could not decode the image");

      return;
    }
    if (
      generation !== this.#dropGeneration ||
      this.#canvas !== canvas
    ) {
      return;
    }
    if (source.width <= 0 || source.height <= 0) {
      this.#setStatus("Could not decode the image");

      return;
    }
    if (
      source.width > canvas.maxTextureSize ||
      source.height > canvas.maxTextureSize
    ) {
      this.#setStatus(
        `Image exceeds the maximum texture size of ${canvas.maxTextureSize}×${canvas.maxTextureSize}`
      );

      return;
    }

    canvas.texture = source;
    canvas.centerTexture();
    this.#setStatus("Texture replaced");
  }

  #clearOverlay(): void {
    if (!this.#bounds) {
      return;
    }

    this.#bounds = null;
    this.#host.requestUpdate();
  }

  #setStatus(
    status: string
  ): void {
    this.#clearStatusTimer();
    this.#status = status;
    this.#statusTimer = window.setTimeout(
      () => this.#clearStatus(),
      kStatusTimeoutMs
    );
    this.#host.requestUpdate();
  }

  #clearStatus(): void {
    this.#clearStatusTimer();
    if (!this.#status) {
      return;
    }

    this.#status = "";
    this.#host.requestUpdate();
  }

  #clearStatusTimer(): void {
    if (this.#statusTimer === null) {
      return;
    }

    window.clearTimeout(this.#statusTimer);
    this.#statusTimer = null;
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
      >${this.#status}</div>
    `;
  }
}
