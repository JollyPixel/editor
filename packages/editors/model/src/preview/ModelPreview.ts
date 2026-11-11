// Import Third-party Dependencies
import {
  disposeObject3D,
  parseModel,
  type Model
} from "@jolly-pixel/engine";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { ModelFile } from "../file/ModelFile.ts";
import {
  ModelResources,
  type ModelCatalog
} from "./ModelResources.ts";
import { ModelStats } from "./ModelStats.ts";

// CONSTANTS
const kEmptyView: ModelView = {
  status: "empty"
};

export type ModelView =
  | {
    readonly status: "empty";
  }
  | {
    readonly status: "loading";
    readonly model: Model | null;
  }
  | {
    readonly status: "ready";
    readonly model: Model;
    readonly stats: ModelStats;
    readonly missing: readonly string[];
  }
  | {
    readonly status: "failed";
    readonly error: string;
    readonly missing: readonly string[];
  };

type ModelPreviewEvents = {
  change: () => void;
};

class ModelRead {
  readonly view: ModelView;

  #resources: ModelResources;

  constructor(
    view: ModelView,
    resources: ModelResources
  ) {
    this.view = view;
    this.#resources = resources;
  }

  dispose(): void {
    disposeView(this.view);
    this.#resources.dispose();
  }
}

export class ModelPreview {
  readonly file: ModelFile;

  #catalog: ModelCatalog;
  #events = new Emitter<ModelPreviewEvents>();
  #loads = 0;
  #view: ModelView = kEmptyView;
  #current: ModelRead | null = null;

  constructor(
    file: ModelFile,
    catalog: ModelCatalog
  ) {
    this.file = file;
    this.#catalog = catalog;
  }

  get view(): ModelView {
    return this.#view;
  }

  get model(): Model | null {
    return "model" in this.#view ? this.#view.model : null;
  }

  subscribe(
    event: keyof ModelPreviewEvents,
    listener: () => void
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  follow(): () => void {
    const unsubscribe = this.file.subscribe(() => {
      void this.reload();
    });
    void this.reload();

    return () => {
      unsubscribe();
      this.#loads++;
      this.#settle(null);
    };
  }

  async reload(): Promise<void> {
    const load = ++this.#loads;
    const { bytes } = this.file;
    if (bytes === null) {
      this.#settle(null);

      return;
    }

    this.#show({
      status: "loading",
      model: this.model
    });
    const read = await this.#load(bytes, load);
    if (load === this.#loads) {
      this.#settle(read);
    }
    else {
      read.dispose();
    }
  }

  async #load(
    bytes: Uint8Array,
    load: number
  ): Promise<ModelRead> {
    const resources = new ModelResources(this.#catalog, this.file.path, () => {
      if (load === this.#loads) {
        void this.reload();
      }
    });
    for (;;) {
      const view = await this.#parse(bytes, resources);
      if (!await resources.fetched() || load !== this.#loads) {
        return new ModelRead(view, resources);
      }
      disposeView(view);
    }
  }

  async #parse(
    bytes: Uint8Array,
    resources: ModelResources
  ): Promise<ModelView> {
    try {
      const model = await parseModel(bytes, this.file.name, {
        manager: resources.manager,
        texture: resources.findTexture()
      });

      return {
        status: "ready",
        model,
        stats: new ModelStats(model),
        missing: resources.names
      };
    }
    catch (error) {
      return {
        status: "failed",
        error: errorMessage(error),
        missing: resources.names
      };
    }
  }

  #settle(
    read: ModelRead | null
  ): void {
    const previous = this.#current;
    this.#current = read;
    this.#show(read?.view ?? kEmptyView);
    previous?.dispose();
  }

  #show(
    view: ModelView
  ): void {
    this.#view = view;
    this.#events.emit("change");
  }
}

function disposeView(
  view: ModelView
): void {
  if (view.status === "ready") {
    disposeObject3D(view.model.object, { textures: true });
  }
}

function errorMessage(
  error: unknown
): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  return error.cause instanceof Error ?
    `${error.message}: ${error.cause.message}` :
    error.message;
}
