// Import Third-party Dependencies
import {
  CATALOG_REPLACE,
  type CatalogClient
} from "@jolly-pixel/asset-server/client";
import {
  MODEL_EXTENSIONS,
  type ModelFileDocument
} from "@jolly-pixel/asset.model/client";
import { fileExtension } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { ModelUpload } from "./ModelUpload.ts";

export interface ModelFileCatalog extends Pick<CatalogClient, "replace" | "can"> {
  on(type: "rights", listener: () => void): unknown;
  off(type: "rights", listener: () => void): unknown;
}

export interface ModelFileSession {
  readonly targetRecord: {
    readonly id: string;
    readonly path: string;
  };
  readonly catalog: ModelFileCatalog;
}

export interface ModelDownload {
  readonly blob: Blob;
  readonly name: string;
}

export class ModelFile {
  #session: ModelFileSession;
  #document: ModelFileDocument;

  constructor(
    session: ModelFileSession,
    document: ModelFileDocument
  ) {
    this.#session = session;
    this.#document = document;
  }

  get bytes(): Uint8Array | null {
    return this.#document.bytes;
  }

  get byteLength(): number {
    return this.#document.bytes?.byteLength ?? 0;
  }

  get path(): string {
    return this.#session.targetRecord.path;
  }

  get name(): string {
    return this.path.slice(this.path.lastIndexOf("/") + 1);
  }

  get extension(): string {
    return fileExtension(this.name);
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
    const upload = new ModelUpload(file, this.extension);
    const report = await this.#session.catalog.replace(
      this.#session.targetRecord.id,
      await upload.bytes()
    );

    return report.replaced;
  }

  download(): ModelDownload | null {
    const { bytes } = this.#document;
    if (bytes === null) {
      return null;
    }

    return {
      blob: new Blob([bytes.slice()], {
        type: MODEL_EXTENSIONS[this.extension] ?? "application/octet-stream"
      }),
      name: this.name
    };
  }
}
