// Import Third-party Dependencies
import {
  disposeObject3D,
  parseModel,
  type Model
} from "@jolly-pixel/engine";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { ModelFile } from "../file/ModelFile.ts";
import { MissingResources } from "./MissingResources.ts";
import { ModelStats } from "./ModelStats.ts";

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

export class ModelPreview {
  readonly file: ModelFile;

  #events = new Emitter<ModelPreviewEvents>();
  #loads = 0;
  #view: ModelView = {
    status: "empty"
  };

  constructor(
    file: ModelFile
  ) {
    this.file = file;
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
      this.#show({
        status: "empty"
      });
    };
  }

  async reload(): Promise<void> {
    const load = ++this.#loads;
    const { bytes } = this.file;
    if (bytes === null) {
      this.#show({
        status: "empty"
      });

      return;
    }

    this.#show({
      status: "loading",
      model: this.model
    });
    const view = await this.#read(bytes);
    if (load === this.#loads) {
      this.#show(view);
    }
    else if (view.status === "ready") {
      disposeObject3D(view.model.object, { textures: true });
    }
  }

  async #read(
    bytes: Uint8Array
  ): Promise<ModelView> {
    const resources = new MissingResources();
    try {
      const model = await parseModel(bytes, this.file.name, {
        manager: resources.manager
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

  #show(
    view: ModelView
  ): void {
    const previous = this.model;
    this.#view = view;
    if (previous !== null && previous !== this.model) {
      disposeObject3D(previous.object, { textures: true });
    }
    this.#events.emit("change");
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
