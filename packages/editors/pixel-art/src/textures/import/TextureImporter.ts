// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";
import { decodeRasterCanvas } from "@jolly-pixel/image/browser";

// Import Internal Dependencies
import { showImportTextureDialog } from "./importTextureDialog.ts";
import { TransientStatus } from "../../shared/TransientStatus.ts";
import { TextureBusy } from "../TextureBusy.ts";
import type { TextureSet } from "../TextureSet.ts";
import {
  DECODE_FAILED_MESSAGE,
  sourceProblem,
  suggestTextureName,
  type TextureAddRequestDetail,
  type TextureImportOrigin,
  type TextureImportPolicy
} from "../textures.ts";

// CONSTANTS
const kDecodingLabel = "Decoding image";

export type TextureImporterHost = ReactiveControllerHost & HTMLElement;

export interface TextureImporterOptions {
  textures: TextureSet;
  policy: () => TextureImportPolicy;
}

export class TextureImporter implements ReactiveController {
  readonly busy: TextureBusy;
  readonly status: TransientStatus;
  readonly #host: TextureImporterHost;
  readonly #textures: TextureSet;
  readonly #policy: () => TextureImportPolicy;
  #generation = 0;

  constructor(
    host: TextureImporterHost,
    options: TextureImporterOptions
  ) {
    this.#host = host;
    this.#textures = options.textures;
    this.#policy = options.policy;
    this.busy = new TextureBusy(host);
    this.status = new TransientStatus(host);
    host.addController(this);
  }

  get policy(): TextureImportPolicy {
    return this.#policy();
  }

  hostDisconnected(): void {
    this.cancel();
  }

  cancel(): void {
    this.#generation++;
    this.busy.clear();
    this.status.clear();
  }

  async importFile(
    canvas: PixelArtCanvas,
    file: File,
    origin: TextureImportOrigin
  ): Promise<void> {
    const generation = ++this.#generation;
    const release = this.busy.begin(origin, kDecodingLabel);
    let source: HTMLCanvasElement;
    try {
      source = await decodeRasterCanvas(file);
    }
    catch {
      if (this.#isCurrent(generation, canvas)) {
        this.status.set(DECODE_FAILED_MESSAGE);
      }

      return;
    }
    finally {
      release();
    }

    if (!this.#isCurrent(generation, canvas)) {
      return;
    }

    const problem = sourceProblem(source, canvas.maxTextureSize);
    if (problem !== null) {
      this.status.set(problem);

      return;
    }

    const replaced = await this.#place(canvas, source, file.name, origin);
    if (replaced && generation === this.#generation) {
      this.status.set("Texture replaced");
    }
  }

  #isCurrent(
    generation: number,
    canvas: PixelArtCanvas
  ): boolean {
    return generation === this.#generation &&
      this.#textures.active?.canvas === canvas;
  }

  async #place(
    canvas: PixelArtCanvas,
    source: HTMLCanvasElement,
    fileName: string,
    origin: TextureImportOrigin
  ): Promise<boolean> {
    const name = suggestTextureName(fileName);
    const policy = this.#policy();
    const choice = policy === "ask" ?
      await showImportTextureDialog({ name }) :
      policy;

    if (choice === "add") {
      this.#requestAdd(name, source, origin);

      return false;
    }
    if (choice === null || !this.#textures.has(canvas)) {
      return false;
    }

    canvas.texture = source;
    canvas.centerTexture();

    return true;
  }

  #requestAdd(
    name: string,
    source: HTMLCanvasElement,
    origin: TextureImportOrigin
  ): void {
    const release = this.busy.begin(origin, `Adding ${name}`);
    const work: Promise<unknown>[] = [];
    this.#host.dispatchEvent(new CustomEvent<TextureAddRequestDetail>(
      "texture-add-request",
      {
        bubbles: true,
        composed: true,
        detail: {
          name,
          source,
          origin,
          respondWith(promise) {
            work.push(promise);
          }
        }
      }
    ));

    if (work.length === 0) {
      release();
    }
    else {
      void Promise.allSettled(work).then(release);
    }
  }
}
