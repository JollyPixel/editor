// Import Third-party Dependencies
import {
  html,
  nothing,
  type ReactiveController,
  type ReactiveControllerHost
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { renderIcon } from "../../shared/icons.ts";
import type { TextureImportPolicy } from "../textures.ts";
import type { TextureImporter } from "./TextureImporter.ts";
import {
  hasSupportedImageDrag,
  isDirectoryItem,
  isSupportedFile
} from "./textureDropFiles.ts";
import { TextureDropBounds } from "./TextureDropBounds.ts";

// CONSTANTS
const kDropLabels: Record<TextureImportPolicy, string> = {
  replace: "Drop image to replace texture",
  add: "Drop image to add texture",
  ask: "Drop image"
};

interface DropTarget {
  canvas: PixelArtCanvas;
  bounds: TextureDropBounds;
}

export interface TextureDropControllerOptions {
  canvas: () => PixelArtCanvas | null;
  importer: TextureImporter;
}

function hasFilePayload(
  dataTransfer: DataTransfer | null
): boolean {
  return dataTransfer !== null && (
    dataTransfer.files.length > 0 ||
    [...dataTransfer.types].includes("Files")
  );
}

function validDropFile(
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

function isInteractiveTarget(
  event: DragEvent
): boolean {
  const target = event.composedPath()[0];

  return target instanceof Element &&
    target.closest(".overlay-toolbar, .tool-option-overlay") !== null;
}

function dropTarget(
  event: DragEvent,
  canvas: PixelArtCanvas | null
): DropTarget | null {
  const stage = event.currentTarget;
  if (!canvas || !(stage instanceof HTMLElement) || isInteractiveTarget(event)) {
    return null;
  }

  const bounds = TextureDropBounds.measure(canvas, stage);
  if (!bounds.contains(event.clientX, event.clientY)) {
    return null;
  }

  return {
    canvas,
    bounds
  };
}

export class TextureDropController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #importer: TextureImporter;
  #bounds: TextureDropBounds | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: TextureDropControllerOptions
  ) {
    this.#host = host;
    this.#canvas = options.canvas;
    this.#importer = options.importer;
    host.addController(this);
  }

  hostConnected(): void {
    window.addEventListener("blur", this.#clearOverlay);
    window.addEventListener("dragend", this.#clearOverlay);
  }

  hostDisconnected(): void {
    window.removeEventListener("blur", this.#clearOverlay);
    window.removeEventListener("dragend", this.#clearOverlay);
    this.#clearOverlay();
  }

  readonly onDragOver = (
    event: DragEvent
  ): void => {
    const target = hasFilePayload(event.dataTransfer) ?
      dropTarget(event, this.#canvas()) :
      null;
    if (target === null) {
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
    this.#bounds = target.bounds;
    this.#host.requestUpdate();
  };

  readonly onDragLeave = (
    event: DragEvent
  ): void => {
    const stage = event.currentTarget;
    const nextTarget = event.relatedTarget;
    if (
      !(stage instanceof Node) ||
      !(nextTarget instanceof Node) ||
      !stage.contains(nextTarget)
    ) {
      this.#clearOverlay();
    }
  };

  readonly onDrop = (
    event: DragEvent
  ): void => {
    const target = dropTarget(event, this.#canvas());
    this.#clearOverlay();
    if (target === null) {
      return;
    }

    event.preventDefault();
    const file = validDropFile(event.dataTransfer);
    if (file) {
      void this.#importer.importFile(target.canvas, file, "drop");
    }
    else if (!event.dataTransfer || event.dataTransfer.files.length !== 1) {
      this.#importer.status.set("Drop one image file");
    }
    else {
      this.#importer.status.set("Unsupported image format");
    }
  };

  readonly #clearOverlay = (): void => {
    if (this.#bounds) {
      this.#bounds = null;
      this.#host.requestUpdate();
    }
  };

  render() {
    if (!this.#bounds) {
      return nothing;
    }

    return html`
      <div
        class="texture-drop-overlay"
        part="texture-drop-overlay"
        style=${this.#bounds.toStyle()}
      >
        ${renderIcon("import")}
        <span>${kDropLabels[this.#importer.policy]}</span>
      </div>
    `;
  }
}
