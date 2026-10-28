// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import { Actor } from "../../../../actor/Actor.ts";
import type { Component } from "../../../../components/types.ts";
import type { World, WorldDefaultContext } from "../../../World.ts";
import type { Logger } from "../../../Logger.ts";
import type {
  ComponentAssetResolver,
  SceneMode
} from "../definitions/ComponentDefinition.ts";
import type { ComponentDefinitions } from "../definitions/ComponentDefinitions.ts";
import type {
  JSONObject,
  SceneActorFile,
  SceneComponentFile
} from "../SceneFile.ts";
import { writeSceneTransform } from "../sceneTransform.ts";

export interface SceneInstanceOptions<
  TContext = WorldDefaultContext
> {
  world: World<any, TContext>;
  mode: SceneMode;
  components: ComponentDefinitions;
  assets: ComponentAssetResolver;
}

export interface SceneInstanceComponent {
  id: string;
  actorId: string;
  component: Component;
}

export type SceneInstanceEvents = {
  componentBuilt: (built: SceneInstanceComponent) => void;
  componentDropped: (component: Component) => void;
};

export class SceneInstance<
  TContext = WorldDefaultContext
> extends Emitter<SceneInstanceEvents> {
  #world: World<any, TContext>;
  #mode: SceneMode;
  #definitions: ComponentDefinitions;
  #assets: ComponentAssetResolver;
  #logger: Logger;
  #actors = new Map<string, Actor<TContext>>();
  #ids = new Map<THREE.Object3D, string>();
  #components = new Map<string, SceneInstanceComponent>();

  constructor(
    options: SceneInstanceOptions<TContext>
  ) {
    super();
    this.#world = options.world;
    this.#mode = options.mode;
    this.#definitions = options.components;
    this.#assets = options.assets;
    this.#logger = options.world.logger.child({
      namespace: "Systems.SceneInstance"
    });
  }

  actor(
    id: string
  ): Actor<TContext> | null {
    return this.#actors.get(id) ?? null;
  }

  actorId(
    object: THREE.Object3D
  ): string | null {
    return this.#ids.get(object) ?? null;
  }

  component(
    id: string
  ): Component | null {
    return this.#components.get(id)?.component ?? null;
  }

  components(): IterableIterator<SceneInstanceComponent> {
    return this.#components.values();
  }

  add(
    files: Iterable<SceneActorFile>
  ): void {
    const kept = new Set<string>();

    for (const file of files) {
      if (this.#actors.has(file.id)) {
        this.#logger.warn("Duplicate actor id skipped", { id: file.id });
        continue;
      }

      const live = this.#world.sceneManager.actors.find(file.id);
      if (
        (file.parentId !== null && kept.has(file.parentId)) ||
        (live !== null && !live.pendingForDestruction)
      ) {
        kept.add(file.id);
        continue;
      }

      const parent = file.parentId === null ?
        null :
        this.#actors.get(file.parentId);
      if (parent === undefined) {
        this.#logger.warn("Actor without a built parent skipped", {
          id: file.id,
          parentId: file.parentId
        });
        continue;
      }

      this.#buildActor(file, parent, live === null);
    }
  }

  remove(
    id: string
  ): void {
    const actor = this.#actors.get(id);
    if (actor === undefined) {
      return;
    }

    const subtree = [actor];
    for (const node of actor.walk()) {
      subtree.push(node.actor);
    }
    actor.destroy();

    for (const { object3D } of subtree) {
      const removedId = this.#ids.get(object3D);
      if (removedId !== undefined) {
        this.#ids.delete(object3D);
        this.#actors.delete(removedId);
      }
    }
    for (const [componentId, built] of this.#components) {
      if (!this.#actors.has(built.actorId)) {
        this.#forgetComponent(componentId);
      }
    }
  }

  reparent(
    id: string,
    parentId: string | null
  ): void {
    const actor = this.#actors.get(id);
    if (actor === undefined) {
      return;
    }

    const parent = parentId === null ?
      null :
      this.#actors.get(parentId) ?? null;
    actor.setParent(parent, true);
  }

  write(
    id: string,
    file: Pick<SceneActorFile, "name" | "visible" | "transform">
  ): void {
    const actor = this.#actors.get(id);
    if (actor === undefined) {
      return;
    }

    actor.name = file.name;
    actor.object3D.visible = file.visible;
    writeSceneTransform(actor.object3D, file.transform);
  }

  removeComponent(
    id: string
  ): void {
    const built = this.#components.get(id);
    if (built !== undefined) {
      built.component.destroy();
      this.#forgetComponent(id);
    }
  }

  rebuildComponent(
    actorId: string,
    entry: SceneComponentFile
  ): void {
    this.removeComponent(entry.id);

    const actor = this.#actors.get(actorId);
    if (actor !== undefined) {
      this.#buildComponent(actorId, actor, entry);
    }
  }

  applyComponent(
    id: string,
    type: string,
    data: Readonly<JSONObject>
  ): boolean {
    const component = this.#components.get(id)?.component;

    return component !== undefined &&
      this.#definitions.apply(component, type, data);
  }

  clear(): void {
    for (const actor of this.#actors.values()) {
      if (actor.parent === null || !this.#ids.has(actor.parent.object3D)) {
        actor.destroy();
      }
    }
    for (const id of [...this.#components.keys()]) {
      this.#forgetComponent(id);
    }
    this.#actors.clear();
    this.#ids.clear();
  }

  #buildActor(
    file: SceneActorFile,
    parent: Actor<TContext> | null,
    restoreId: boolean
  ): void {
    const actor = new Actor<TContext>(this.#world, {
      name: file.name,
      parent,
      visible: file.visible,
      persistentId: restoreId ? file.id : undefined
    });
    writeSceneTransform(actor.object3D, file.transform);
    this.#actors.set(file.id, actor);
    this.#ids.set(actor.object3D, file.id);

    for (const entry of file.components) {
      this.#buildComponent(file.id, actor, entry);
    }
  }

  #buildComponent(
    actorId: string,
    actor: Actor<TContext>,
    entry: SceneComponentFile
  ): void {
    if (this.#definitions.find(entry.type) === null) {
      if (this.#mode === "play") {
        this.#logger.warn("Unknown component type skipped", {
          type: entry.type,
          actor: actor.name
        });
      }

      return;
    }

    const component = this.#definitions.create(actor, entry, {
      mode: this.#mode,
      resolver: this.#assets
    });
    if (component !== null) {
      const built = {
        id: entry.id,
        actorId,
        component
      };
      this.#components.set(entry.id, built);
      this.emit("componentBuilt", built);
    }
  }

  #forgetComponent(
    id: string
  ): void {
    const built = this.#components.get(id);
    if (built !== undefined) {
      this.#components.delete(id);
      this.emit("componentDropped", built.component);
    }
  }
}
