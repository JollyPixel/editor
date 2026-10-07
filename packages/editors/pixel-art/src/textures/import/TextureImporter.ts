// Import Third-party Dependencies
import type {
  ReactiveController,
  ReactiveControllerHost
} from "lit";
import type { PixelArtCanvas } from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { TransientStatus } from "../../shared/TransientStatus.ts";
import { TextureBusy } from "./TextureBusy.ts";
import { TextureSource } from "./TextureSource.ts";
import { TextureImportError } from "./errors/TextureImportError.ts";
import type { TextureSet } from "../TextureSet.ts";
import type { ImportTextureDialog } from "../dialogs/ImportTextureDialog.ts";

// CONSTANTS
const kDecodingLabel = "Decoding image";

export type TextureImportPolicy = "replace" | "add" | "ask";

export type TextureImportOrigin = "import" | "drop";

export interface TextureAddRequestDetail {
  name: string;
  source: HTMLCanvasElement;
  origin: TextureImportOrigin;
  uvSize: number | null;
  respondWith(work: Promise<unknown>): void;
}

export type TextureImporterHost = ReactiveControllerHost & HTMLElement;

export interface TextureImporterOptions {
  textures: TextureSet;
  policy: () => TextureImportPolicy;
  dialog: () => Pick<ImportTextureDialog, "open">;
}

export class TextureImporter implements ReactiveController {
  static parsePolicy(
    value: string | null | undefined
  ): TextureImportPolicy | null {
    switch (value) {
      case "replace":
      case "add":
      case "ask":
        return value;
      default:
        return null;
    }
  }

  readonly busy: TextureBusy;
  readonly status: TransientStatus;
  readonly #host: TextureImporterHost;
  readonly #textures: TextureSet;
  readonly #policy: () => TextureImportPolicy;
  readonly #dialog: () => Pick<ImportTextureDialog, "open">;
  #generation = 0;

  constructor(
    host: TextureImporterHost,
    options: TextureImporterOptions
  ) {
    this.#host = host;
    this.#textures = options.textures;
    this.#policy = options.policy;
    this.#dialog = options.dialog;
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
    let source: TextureSource;
    try {
      source = await TextureSource.decode(file, canvas.maxTextureSize);
    }
    catch (error) {
      if (!(error instanceof TextureImportError)) {
        throw error;
      }
      if (this.#isCurrent(generation, canvas)) {
        this.status.set(error.message);
      }

      return;
    }
    finally {
      release();
    }

    if (!this.#isCurrent(generation, canvas)) {
      return;
    }

    const replaced = await this.#place(canvas, source, origin);
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
    source: TextureSource,
    origin: TextureImportOrigin
  ): Promise<boolean> {
    const policy = this.#policy();
    const result = policy === "ask" ?
      await this.#dialog().open({
        name: source.name.value,
        size: source.size
      }) :
      {
        choice: policy,
        uvSize: null
      };

    if (result?.choice === "add") {
      this.#requestAdd(source, origin, result.uvSize);

      return false;
    }
    if (result === null || !this.#textures.has(canvas)) {
      return false;
    }

    canvas.texture = source.canvas;
    canvas.centerTexture();

    return true;
  }

  #requestAdd(
    source: TextureSource,
    origin: TextureImportOrigin,
    uvSize: number | null
  ): void {
    const name = source.name.value;
    const release = this.busy.begin(origin, `Adding ${name}`);
    const work: Promise<unknown>[] = [];
    this.#host.dispatchEvent(new CustomEvent<TextureAddRequestDetail>(
      "texture-add-request",
      {
        bubbles: true,
        composed: true,
        detail: {
          name,
          source: source.canvas,
          origin,
          uvSize,
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
