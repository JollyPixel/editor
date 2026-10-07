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
import type {
  TextureImporter,
  TextureImportPolicy
} from "./TextureImporter.ts";
import { ImageDrop } from "./ImageDrop.ts";
import { TextureDropBounds } from "./TextureDropBounds.ts";
import { TextureImportError } from "./errors/TextureImportError.ts";

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
    const drop = new ImageDrop(event.dataTransfer);
    const target = drop.carriesFiles ? this.#target(event) : null;
    if (target === null) {
      this.#clearOverlay();

      return;
    }

    event.preventDefault();
    if (!drop.supported) {
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
    const target = this.#target(event);
    this.#clearOverlay();
    if (target === null) {
      return;
    }

    event.preventDefault();
    let file: File;
    try {
      file = new ImageDrop(event.dataTransfer).file();
    }
    catch (error) {
      if (!(error instanceof TextureImportError)) {
        throw error;
      }
      this.#importer.status.set(error.message);

      return;
    }

    void this.#importer.importFile(target.canvas, file, "drop");
  };

  readonly #clearOverlay = (): void => {
    if (this.#bounds) {
      this.#bounds = null;
      this.#host.requestUpdate();
    }
  };

  #target(
    event: DragEvent
  ): DropTarget | null {
    const canvas = this.#canvas();
    const stage = event.currentTarget;
    if (
      !canvas ||
      canvas.pixelsReadOnly ||
      !(stage instanceof HTMLElement) ||
      this.#isOverToolbar(event)
    ) {
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

  #isOverToolbar(
    event: DragEvent
  ): boolean {
    const target = event.composedPath()[0];

    return target instanceof Element &&
      target.closest(".overlay-toolbar, .tool-option-overlay") !== null;
  }

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
