// Import Third-party Dependencies
import { TEXTURE_EXTENSIONS } from "@jolly-pixel/asset-server";
import {
  CATALOG_REPLACE,
  type CatalogClient
} from "@jolly-pixel/asset-server/client";
import { fileExtension } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { TextureDocument } from "../document/TextureDocument.ts";
import { TextureUpload } from "./TextureUpload.ts";

export interface TextureFileCatalog extends Pick<CatalogClient, "replace" | "can"> {
  on(type: "rights", listener: () => void): unknown;
  off(type: "rights", listener: () => void): unknown;
}

export interface TextureFileSession {
  readonly targetRecord: {
    readonly id: string;
    readonly path: string;
  };
  readonly catalog: TextureFileCatalog;
}

export interface TextureDownload {
  readonly blob: Blob;
  readonly name: string;
}

export class TextureFile {
  #session: TextureFileSession;
  #document: TextureDocument;

  constructor(
    session: TextureFileSession,
    document: TextureDocument
  ) {
    this.#session = session;
    this.#document = document;
  }

  get bytes(): Uint8Array | null {
    return this.#document.bytes;
  }

  get byteLength(): number {
    return this.bytes?.byteLength ?? 0;
  }

  get name(): string {
    const { path } = this.#session.targetRecord;

    return path.slice(path.lastIndexOf("/") + 1);
  }

  get extension(): string {
    return fileExtension(this.name);
  }

  get mimeType(): string {
    return TEXTURE_EXTENSIONS[this.extension] ?? "application/octet-stream";
  }

  get replaceable(): boolean {
    return this.#session.catalog.can(CATALOG_REPLACE);
  }

  subscribe(
    listener: () => void
  ): () => void {
    return this.#document.subscribe("reset", () => listener());
  }

  subscribeRights(
    listener: () => void
  ): () => void {
    const { catalog } = this.#session;
    catalog.on("rights", listener);

    return () => {
      catalog.off("rights", listener);
    };
  }

  async replace(
    file: File
  ): Promise<boolean> {
    const upload = new TextureUpload(file, this.extension);
    const report = await this.#session.catalog.replace(
      this.#session.targetRecord.id,
      await upload.bytes()
    );

    return report.replaced;
  }

  download(): TextureDownload | null {
    const { bytes } = this.#document;
    if (bytes === null) {
      return null;
    }

    return {
      blob: new Blob([bytes.slice()], {
        type: this.mimeType
      }),
      name: this.name
    };
  }
}
