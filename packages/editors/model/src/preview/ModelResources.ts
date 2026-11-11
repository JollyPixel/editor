// Import Third-party Dependencies
import {
  AssetPath,
  type AssetRecordData
} from "@jolly-pixel/asset";
import { modelTextureNames } from "@jolly-pixel/engine";
import * as THREE from "three/webgpu";
import { fileExtension } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { MissingResourceError } from "./errors/MissingResourceError.ts";

// CONSTANTS
const kBlankPixel = "data:image/png;base64," +
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const kInlineSchemes = ["data:", "blob:"];
const kImageExtensions = new Set([
  ".bmp",
  ".dds",
  ".gif",
  ".jpeg",
  ".jpg",
  ".ktx2",
  ".png",
  ".tga",
  ".tif",
  ".tiff",
  ".webp"
]);

export interface ModelCatalog {
  records(): Iterable<AssetRecordData>;
  read(
    assetId: string
  ): Promise<Uint8Array>;
  subscribe(
    event: "change",
    listener: () => void
  ): () => void;
}

export class ModelResources {
  readonly manager: THREE.LoadingManager;

  #catalog: ModelCatalog;
  #model: AssetPath;
  #names = new Set<string>();
  #requested = new Map<string, string | null>();
  #contents = new Map<string, string | null>();
  #pending = new Map<string, Promise<void>>();
  #unsubscribe: () => void;

  constructor(
    catalog: ModelCatalog,
    modelPath: string,
    onStale: () => void
  ) {
    this.#catalog = catalog;
    this.#model = new AssetPath(modelPath);
    this.manager = new THREE.LoadingManager()
      .setURLModifier((url) => this.#resolve(url));
    this.#unsubscribe = catalog.subscribe("change", () => {
      if (this.#stale()) {
        onStale();
      }
    });
  }

  get names(): string[] {
    return [...this.#names];
  }

  findTexture(): string | undefined {
    for (const name of modelTextureNames(this.#model.toString())) {
      const path = this.#model.resolve(name).toString();
      const record = this.#record(path);
      this.#requested.set(path, revisionKey(record));
      if (record !== undefined) {
        return name;
      }
    }

    return undefined;
  }

  async fetched(): Promise<boolean> {
    if (this.#pending.size === 0) {
      return false;
    }

    await Promise.all(this.#pending.values());
    this.#pending.clear();

    return true;
  }

  dispose(): void {
    this.#unsubscribe();
    for (const url of this.#contents.values()) {
      if (url !== null) {
        URL.revokeObjectURL(url);
      }
    }
    this.#contents.clear();
  }

  #resolve(
    url: string
  ): string {
    if (kInlineSchemes.some((scheme) => url.startsWith(scheme))) {
      return url;
    }

    const path = this.#model.resolve(url);
    const name = `${path.name}${path.extension}`;
    const record = this.#record(path.toString());
    this.#requested.set(path.toString(), revisionKey(record));
    if (record !== undefined) {
      const content = this.#contents.get(record.id);
      if (content === undefined) {
        this.#fetch(record.id);

        return placeholder(name);
      }
      if (content !== null) {
        return content;
      }
    }

    this.#names.add(name);

    return placeholder(name);
  }

  #record(
    path: string
  ): AssetRecordData | undefined {
    for (const record of this.#catalog.records()) {
      if (record.path === path) {
        return record;
      }
    }

    return undefined;
  }

  #stale(): boolean {
    const revisions = new Map<string, string | null>();
    for (const record of this.#catalog.records()) {
      if (this.#requested.has(record.path)) {
        revisions.set(record.path, revisionKey(record));
      }
    }
    for (const [path, revision] of this.#requested) {
      if ((revisions.get(path) ?? null) !== revision) {
        return true;
      }
    }

    return false;
  }

  #fetch(
    assetId: string
  ): void {
    if (this.#pending.has(assetId)) {
      return;
    }

    this.#pending.set(assetId, this.#catalog.read(assetId).then(
      (content) => {
        this.#contents.set(
          assetId,
          URL.createObjectURL(new Blob([content.slice()]))
        );
      },
      () => {
        this.#contents.set(assetId, null);
      }
    ));
  }
}

function revisionKey(
  record: AssetRecordData | undefined
): string | null {
  return record === undefined ?
    null :
    `${record.id}@${record.revision ?? ""}`;
}

function placeholder(
  name: string
): string {
  if (!kImageExtensions.has(fileExtension(name))) {
    throw new MissingResourceError(name);
  }

  return kBlankPixel;
}
