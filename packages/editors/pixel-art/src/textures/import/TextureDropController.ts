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
import {
  claimingDrop,
  type TextureFileDrop
} from "./TextureFileDrop.ts";
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
  fileDrops: () => readonly TextureFileDrop[];
}

export class TextureDropController implements ReactiveController {
  readonly #host: ReactiveControllerHost;
  readonly #canvas: () => PixelArtCanvas | null;
  readonly #importer: TextureImporter;
  readonly #fileDrops: () => readonly TextureFileDrop[];
  #bounds: TextureDropBounds | null = null;
  #label: string | null = null;

  constructor(
    host: ReactiveControllerHost,
    options: TextureDropControllerOptions
  ) {
    this.#host = host;
    this.#canvas = options.canvas;
    this.#importer = options.importer;
    this.#fileDrops = options.fileDrops;
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
    const type = drop.draggedType;
    const claim = type === null ?
      undefined :
      claimingDrop(this.#fileDrops(), { type });
    const target = drop.carriesFiles ? this.#target(event, claim) : null;
    if (target === null) {
      this.#clearOverlay();

      return;
    }

    event.preventDefault();
    if (claim === undefined && !drop.supported) {
      this.#clearOverlay();

      return;
    }

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy";
    }
    this.#bounds = target.bounds;
    this.#label = claim?.label ?? null;
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
    const drop = new ImageDrop(event.dataTransfer);
    const file = drop.singleFile;
    const claim = file === null ?
      undefined :
      claimingDrop(this.#fileDrops(), file);
    const target = this.#target(event, claim);
    this.#clearOverlay();
    if (target === null) {
      return;
    }

    event.preventDefault();
    if (claim !== undefined && file !== null) {
      claim.drop(file);

      return;
    }

    let image: File;
    try {
      image = drop.file();
    }
    catch (error) {
      if (!(error instanceof TextureImportError)) {
        throw error;
      }
      this.#importer.status.set(error.message);

      return;
    }

    void this.#importer.importFile(target.canvas, image, "drop");
  };

  readonly #clearOverlay = (): void => {
    if (this.#bounds) {
      this.#bounds = null;
      this.#label = null;
      this.#host.requestUpdate();
    }
  };

  #target(
    event: DragEvent,
    claim: TextureFileDrop | undefined
  ): DropTarget | null {
    const canvas = this.#canvas();
    const stage = event.currentTarget;
    if (
      !canvas ||
      (claim === undefined && canvas.pixelsReadOnly) ||
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
        <span>${this.#label ?? kDropLabels[this.#importer.policy]}</span>
      </div>
    `;
  }
}
