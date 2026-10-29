// Import Third-party Dependencies
import {
  ComponentChange,
  type SceneActorView,
  type SceneChange,
  type SceneComponentJSON,
  type SceneDocument,
  type SceneEnvironmentJSON,
  type SceneEnvironmentPatch,
  type SceneTransformJSON,
  type SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { SceneBinding } from "../scene/SceneBinding.ts";

export type SceneDraftView = Pick<
  SceneBinding,
  "previewEnvironment" | "previewTransform" | "previewComponent"
>;

export interface SceneDraftOptions {
  document: SceneDocument;
  view: SceneDraftView;
}

export type SceneDraftEvents = {
  change: () => void;
};

export class SceneDraft extends Emitter<SceneDraftEvents> {
  #document: SceneDocument;
  #view: SceneDraftView;
  #environment: SceneEnvironmentPatch = {};
  #transforms = new Map<string, SceneTransformPatch>();
  #components = new Map<string, ComponentChange>();
  #unsubscribe: (() => void)[];

  constructor(
    options: SceneDraftOptions
  ) {
    super();
    this.#document = options.document;
    this.#view = options.view;
    this.#unsubscribe = [
      options.document.subscribe("change", (change) => this.#settle(change)),
      options.document.subscribe("reset", () => this.#discard())
    ];
  }

  environment(): SceneEnvironmentJSON {
    return {
      ...this.#document.tree.environment,
      ...this.#environment
    };
  }

  transform(
    actor: SceneActorView
  ): SceneTransformJSON {
    return {
      ...actor.transform,
      ...this.#transforms.get(actor.id)
    };
  }

  component(
    entry: SceneComponentJSON
  ): SceneComponentJSON {
    const change = this.#components.get(entry.id);

    return change === undefined ? entry : {
      ...entry,
      data: change.applyTo(entry.data)
    };
  }

  editEnvironment(
    patch: SceneEnvironmentPatch
  ): void {
    this.#environment = {
      ...this.#environment,
      ...patch
    };
    this.#view.previewEnvironment(this.#environment);
    this.emit("change");
  }

  editTransform(
    id: string,
    patch: SceneTransformPatch
  ): void {
    const transform = {
      ...this.#transforms.get(id),
      ...patch
    };
    this.#transforms.set(id, transform);
    this.#view.previewTransform(id, transform);
    this.emit("change");
  }

  editComponent(
    id: string,
    change: ComponentChange
  ): void {
    this.#components.set(id, change);
    this.#view.previewComponent(id, change);
    this.emit("change");
  }

  commitEnvironment(
    patch: SceneEnvironmentPatch
  ): void {
    this.#environment = {};
    if (!this.#document.changeEnvironment(patch)) {
      this.#view.previewEnvironment({});
    }
    this.emit("change");
  }

  commitTransform(
    id: string,
    patch: SceneTransformPatch
  ): void {
    this.#transforms.delete(id);
    if (!this.#document.transform(id, patch)) {
      this.#view.previewTransform(id, {});
    }
    this.emit("change");
  }

  commitComponent(
    id: string,
    change: ComponentChange
  ): void {
    this.#components.delete(id);
    if (!this.#document.changeComponent(id, change)) {
      this.#view.previewComponent(id, ComponentChange.NONE);
    }
    this.emit("change");
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
  }

  #settle(
    { command }: SceneChange
  ): void {
    switch (command.action) {
      case "environment-changed":
        this.#environment = {};
        break;
      case "actor-transformed":
        this.#transforms.delete(command.id);
        break;
      case "component-changed":
        this.#components.delete(command.id);
        break;
    }
  }

  #discard(): void {
    this.#environment = {};
    this.#transforms.clear();
    this.#components.clear();
  }
}
