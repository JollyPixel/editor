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
import type {
  ComponentAnchor,
  SceneActorAnchor,
  SceneAnchorsReader
} from "../definitions/ComponentAnchors.ts";
import type { ComponentDefinitions } from "../definitions/ComponentDefinitions.ts";
import type {
  JSONObject,
  SceneActorFile,
  SceneAnchorFile,
  SceneComponentFile
} from "../SceneFile.ts";
import {
  NO_SCENE_PREFABS,
  type ScenePrefabs
} from "../ScenePrefabs.ts";
import { writeSceneTransform } from "../sceneTransform.ts";
import { SceneAnchors } from "./SceneAnchors.ts";

export interface SceneInstanceOptions<
  TContext = WorldDefaultContext
> {
  world: World<any, TContext>;
  mode: SceneMode;
  components: ComponentDefinitions;
  assets: ComponentAssetResolver;
  /**
   * Scene files that prefab instances expand.
   */
  prefabs?: ScenePrefabs;
  /**
   * Id of the scene this instance builds, never expanded as a prefab.
   */
  sceneId?: string;
}

export interface SceneInstanceComponent {
  id: string;
  actorId: string;
  component: Component;
}

interface PrefabInstance {
  sceneId: string;
  chain: readonly string[];
  roots: string[];
}

export type SceneInstanceEvents = {
  componentBuilt: (built: SceneInstanceComponent) => void;
  componentDropped: (component: Component) => void;
  anchorsChange: () => void;
};

export class SceneInstance<
  TContext = WorldDefaultContext
> extends Emitter<SceneInstanceEvents> implements SceneAnchorsReader {
  #world: World<any, TContext>;
  #mode: SceneMode;
  #definitions: ComponentDefinitions;
  #assets: ComponentAssetResolver;
  #prefabs: ScenePrefabs;
  #chain: readonly string[];
  #logger: Logger;
  #actors = new Map<string, Actor<TContext>>();
  #ids = new Map<THREE.Object3D, string>();
  #components = new Map<string, SceneInstanceComponent>();
  #instances = new Map<string, PrefabInstance>();
  #anchors = new SceneAnchors(
    () => this.emit("anchorsChange")
  );

  constructor(
    options: SceneInstanceOptions<TContext>
  ) {
    super();
    this.#world = options.world;
    this.#mode = options.mode;
    this.#definitions = options.components;
    this.#assets = options.assets;
    this.#prefabs = options.prefabs ?? NO_SCENE_PREFABS;
    this.#chain = options.sceneId === undefined ? [] : [options.sceneId];
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

  * anchors(
    actorId: string
  ): IterableIterator<SceneActorAnchor> {
    const owner = this.#actors.get(actorId);
    if (owner !== undefined) {
      yield* this.#anchors.list(owner);
    }
  }

  findAnchor(
    actorId: string,
    anchor: SceneAnchorFile
  ): ComponentAnchor | null {
    const owner = this.#actors.get(actorId);

    return owner === undefined ? null : this.#anchors.find(owner, anchor);
  }

  add(
    files: Iterable<SceneActorFile>
  ): void {
    this.#add(files, this.#chain);
  }

  refresh(
    sceneId: string
  ): void {
    const instanceIds = [...this.#instances]
      .filter(([, instance]) => instance.sceneId === sceneId)
      .map(([id]) => id);

    for (const id of instanceIds) {
      this.#collapse(id);
    }
    const outermostIds = instanceIds.filter((id) => this.#instances.has(id));
    for (const id of outermostIds) {
      this.#expand(id);
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
        this.#instances.delete(removedId);
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
    parentId: string | null,
    anchor?: SceneAnchorFile
  ): void {
    const actor = this.#actors.get(id);
    if (actor === undefined) {
      return;
    }

    const parent = parentId === null ?
      null :
      this.#actors.get(parentId) ?? null;
    actor.setParent(parent, true);
    this.#seat(actor, parent, anchor);
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
    this.#anchors.clear();
    this.#actors.clear();
    this.#ids.clear();
    this.#instances.clear();
  }

  #add(
    files: Iterable<SceneActorFile>,
    chain: readonly string[]
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

      this.#buildActor(file, parent, live === null, chain);
    }
  }

  #expand(
    instanceId: string
  ): void {
    const instance = this.#instances.get(instanceId);
    if (instance === undefined) {
      return;
    }
    if (instance.chain.includes(instance.sceneId)) {
      this.#logger.warn("Prefab cycle skipped", {
        id: instanceId,
        sceneId: instance.sceneId
      });

      return;
    }

    const scene = this.#prefabs.find(instance.sceneId);
    if (scene !== null) {
      const files = scene.actors.map(
        (file) => scopedActorFile(file, instanceId)
      );
      instance.roots = files
        .filter((file) => file.parentId === instanceId)
        .map((file) => file.id);
      this.#add(files, [...instance.chain, instance.sceneId]);
    }
  }

  #collapse(
    instanceId: string
  ): void {
    const instance = this.#instances.get(instanceId);
    if (instance === undefined) {
      return;
    }

    for (const id of instance.roots) {
      this.remove(id);
    }
    instance.roots = [];
  }

  #buildActor(
    file: SceneActorFile,
    parent: Actor<TContext> | null,
    restoreId: boolean,
    chain: readonly string[]
  ): void {
    const actor = new Actor<TContext>(this.#world, {
      name: file.name,
      parent,
      visible: file.visible,
      persistentId: restoreId ? file.id : undefined
    });
    this.#seat(actor, parent, file.anchor);
    writeSceneTransform(actor.object3D, file.transform);
    this.#actors.set(file.id, actor);
    this.#ids.set(actor.object3D, file.id);

    for (const entry of file.components) {
      this.#buildComponent(file.id, actor, entry);
    }

    if (file.prefab !== undefined) {
      this.#instances.set(file.id, {
        sceneId: file.prefab.id,
        chain,
        roots: []
      });
      this.#expand(file.id);
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
      const anchors = this.#definitions.anchors(component);
      if (anchors !== null) {
        this.#anchors.provide(entry.id, actor, anchors);
      }
      this.emit("componentBuilt", built);
    }
  }

  #seat(
    actor: Actor<TContext>,
    parent: Actor<TContext> | null,
    anchor: SceneAnchorFile | undefined
  ): void {
    if (parent !== null && anchor !== undefined) {
      this.#anchors.socket(parent, anchor).add(actor.object3D);
    }
  }

  #forgetComponent(
    id: string
  ): void {
    const built = this.#components.get(id);
    if (built !== undefined) {
      this.#components.delete(id);
      this.#anchors.forget(id);
      this.emit("componentDropped", built.component);
    }
  }
}

function scopedActorFile(
  file: SceneActorFile,
  instanceId: string
): SceneActorFile {
  return {
    ...file,
    id: `${instanceId}/${file.id}`,
    parentId: file.parentId === null ?
      instanceId :
      `${instanceId}/${file.parentId}`,
    components: file.components.map((component) => {
      return {
        ...component,
        id: `${instanceId}/${component.id}`
      };
    }),
    ...file.anchor === undefined ? {} : {
      anchor: {
        component: `${instanceId}/${file.anchor.component}`,
        key: file.anchor.key
      }
    }
  };
}
