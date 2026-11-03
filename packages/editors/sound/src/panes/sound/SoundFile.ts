// Import Third-party Dependencies
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import {
  SOUND_CONTENT_TYPE,
  SOUND_EXTENSION,
  type SoundDocument
} from "@jolly-pixel/asset.sound/client";

// Import Internal Dependencies
import { SoundUpload } from "./SoundUpload.ts";

export type SoundFileCatalog = Pick<CatalogClient, "record" | "replace">;

export interface SoundFileOptions {
  catalog: SoundFileCatalog;
  assetId: string;
  document: SoundDocument;
}

export interface SoundDownload {
  readonly blob: Blob;
  readonly name: string;
}

export class SoundFile {
  #catalog: SoundFileCatalog;
  #assetId: string;
  #document: SoundDocument;

  constructor(
    options: SoundFileOptions
  ) {
    this.#catalog = options.catalog;
    this.#assetId = options.assetId;
    this.#document = options.document;
  }

  get empty(): boolean {
    return this.#document.bytes === null;
  }

  subscribe(
    listener: () => void
  ): () => void {
    return this.#document.subscribe("reset", () => listener());
  }

  async replace(
    file: File
  ): Promise<boolean> {
    const upload = new SoundUpload(file);
    const report = await this.#catalog.replace(
      this.#assetId,
      await upload.bytes(),
      {
        from: upload.from
      }
    );

    return report.replaced;
  }

  download(): SoundDownload | null {
    const { bytes } = this.#document;
    if (bytes === null) {
      return null;
    }

    return {
      blob: new Blob([bytes.slice()], {
        type: SOUND_CONTENT_TYPE
      }),
      name: `${this.#stem()}${SOUND_EXTENSION}`
    };
  }

  #stem(): string {
    const path = this.#catalog.record(this.#assetId)?.path ?? "";
    const name = path.slice(path.lastIndexOf("/") + 1);
    const dot = name.lastIndexOf(".");
    const stem = dot === -1 ? name : name.slice(0, dot);

    return stem === "" ? "sound" : stem;
  }
}
