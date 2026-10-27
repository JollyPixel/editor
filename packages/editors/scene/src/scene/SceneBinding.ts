// Import Third-party Dependencies
import * as THREE from "three";
import {
  Systems,
  type Actor,
  type Component
} from "@jolly-pixel/engine";
import {
  applyComponentChange,
  type ComponentChange,
  type SceneActorJSON,
  type SceneChange,
  type SceneDocument,
  type SceneEnvironmentJSON,
  type SceneEnvironmentPatch,
  type SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import { Emitter } from "@openally/emitt";

// CONSTANTS
const kWorldPosition = new THREE.Vector3();

export interface SceneEnvironmentTarget {
  apply(environment: SceneEnvironmentJSON): void;
}

export interface SceneBindingOptions {
  world: Systems.World;
  document: SceneDocument;
  components: Systems.ComponentDefinitions;
  assets: Systems.ComponentAssetResolver;
  environment: SceneEnvironmentTarget;
}

export interface BoundComponent {
  component: Component;
  actorId: string;
}

export type SceneBindingEvents = {
  actorsChange: () => void;
  componentBuilt: (bound: BoundComponent) => void;
  componentDropped: (component: Component) => void;
};

export class SceneBinding extends Emitter<SceneBindingEvents> {
  #world: Systems.World;
  #document: SceneDocument;
  #definitions: Systems.ComponentDefinitions;
  #builder: Systems.SceneBuilder;
  #environment: SceneEnvironmentTarget;
  #actors = new Map<string, Actor>();
  #components = new Map<string, BoundComponent>();
  #actorIds = new Map<THREE.Object3D, string>();

  #onChange = (
    change: SceneChange
  ): void => {
    this.#applyChange(change);
    this.#world.invalidate();
  };

  #onReset = (): void => {
    this.#rebuild();
    this.#world.invalidate();
  };

  constructor(
    options: SceneBindingOptions
  ) {
    super();
    this.#world = options.world;
    this.#document = options.document;
    this.#definitions = options.components;
    this.#environment = options.environment;
    this.#builder = new Systems.SceneBuilder({
      world: options.world,
      mode: "edit",
      components: options.components,
      assets: options.assets
    });

    this.#rebuild();
    this.#document.on("change", this.#onChange);
    this.#document.on("reset", this.#onReset);
  }

  actor(
    id: string
  ): Actor | null {
    return this.#actors.get(id) ?? null;
  }

  component(
    id: string
  ): Component | null {
    return this.#components.get(id)?.component ?? null;
  }

  components(): IterableIterator<BoundComponent> {
    return this.#components.values();
  }

  worldBounds(
    ids: Iterable<string>
  ): THREE.Box3 {
    const bounds = new THREE.Box3();
    for (const id of ids) {
      const object = this.#actors.get(id)?.object3D;
      if (object !== undefined) {
        bounds.expandByObject(object);
        bounds.expandByPoint(object.getWorldPosition(kWorldPosition));
      }
    }

    return bounds;
  }

  findActorId(
    object: THREE.Object3D
  ): string | null {
    let current: THREE.Object3D | null = object;
    while (current !== null) {
      const id = this.#actorIds.get(current);
      if (id !== undefined) {
        return id;
      }
      current = current.parent;
    }

    return null;
  }

  addPickTarget(
    object: THREE.Object3D,
    actorId: string
  ): () => void {
    this.#actorIds.set(object, actorId);

    return () => {
      if (this.#actorIds.get(object) === actorId) {
        this.#actorIds.delete(object);
      }
    };
  }

  restoreActor(
    id: string
  ): void {
    this.#syncActor(id);
  }

  previewEnvironment(
    patch: SceneEnvironmentPatch
  ): void {
    this.#environment.apply({
      ...this.#document.tree.environment,
      ...patch
    });
    this.#world.invalidate();
  }

  previewTransform(
    id: string,
    patch: SceneTransformPatch
  ): void {
    this.#syncActor(id, patch);
    this.#world.invalidate();
  }

  previewComponent(
    id: string,
    change: ComponentChange
  ): void {
    if (this.#applyComponent(id, change)) {
      this.#world.invalidate();
    }
  }

  dispose(): void {
    this.#document.off("change", this.#onChange);
    this.#document.off("reset", this.#onReset);
    this.#clear();
  }

  #applyChange(
    change: SceneChange
  ): void {
    const { command } = change;
    const { tree } = this.#document;

    switch (command.action) {
      case "actor-added":
        this.#buildActors(command.actors.map((actor) => actor.id));
        break;
      case "actor-removed":
        this.#actors.get(command.id)?.destroy();
        this.#forgetRemoved();
        break;
      case "actor-moved":
        this.#reparent(command.id);
        break;
      case "actor-renamed":
      case "actor-visibility":
      case "actor-transformed":
        this.#syncActor(command.id);
        break;
      case "component-added":
      case "component-assets-changed":
        this.#rebuildComponent(command.action === "component-added" ?
          command.component.id :
          command.id);
        break;
      case "component-removed":
        this.#removeComponent(command.id);
        break;
      case "component-changed":
        this.#changeComponent(command.id);
        break;
      case "component-moved":
        break;
      case "environment-changed":
        this.#environment.apply(tree.environment);
        break;
    }
  }

  #rebuild(): void {
    this.#clear();
    this.#buildActors(this.#document.tree.actorIds());
    this.#environment.apply(this.#document.tree.environment);
  }

  #clear(): void {
    const owned = new Set<Actor>(this.#actors.values());
    for (const actor of owned) {
      if (actor.parent === null || !owned.has(actor.parent)) {
        actor.destroy();
      }
    }
    for (const id of [...this.#components.keys()]) {
      this.#forgetComponent(id);
    }
    this.#actors.clear();
    this.#actorIds.clear();
  }

  #buildActors(
    ids: Iterable<string>
  ): void {
    for (const id of ids) {
      const file = this.#document.tree.actor(id);
      if (file !== undefined) {
        this.#buildActor(file);
      }
    }
    this.emit("actorsChange");
  }

  #buildActor(
    file: SceneActorJSON
  ): void {
    const parent = file.parentId === null ?
      null :
      this.#actors.get(file.parentId);
    if (parent === undefined) {
      return;
    }

    const build = this.#builder.buildActor(file, parent);
    const actor = build.actor(file.id);
    if (actor === null) {
      return;
    }

    this.#actors.set(file.id, actor);
    this.#actorIds.set(actor.object3D, file.id);
    for (const entry of file.components) {
      const component = build.component(entry.id);
      if (component !== null) {
        this.#bindComponent(entry.id, component, file.id);
      }
    }
  }

  #bindComponent(
    id: string,
    component: Component,
    actorId: string
  ): void {
    const bound = {
      component,
      actorId
    };
    this.#components.set(id, bound);
    this.emit("componentBuilt", bound);
  }

  #forgetComponent(
    id: string
  ): void {
    const bound = this.#components.get(id);
    if (bound !== undefined) {
      this.#components.delete(id);
      this.emit("componentDropped", bound.component);
    }
  }

  #forgetRemoved(): void {
    for (const [id, actor] of this.#actors) {
      if (!this.#document.tree.has(id)) {
        this.#actors.delete(id);
        this.#actorIds.delete(actor.object3D);
      }
    }
    for (const id of [...this.#components.keys()]) {
      if (this.#document.tree.componentOwner(id) === undefined) {
        this.#forgetComponent(id);
      }
    }
    this.emit("actorsChange");
  }

  #reparent(
    id: string
  ): void {
    const actor = this.#actors.get(id);
    const file = this.#document.tree.peekActor(id);
    if (actor === undefined || file === undefined) {
      return;
    }

    const parent = file.parentId === null ?
      null :
      this.#actors.get(file.parentId) ?? null;
    actor.setParent(parent, true);
    this.#syncActor(id);
  }

  #syncActor(
    id: string,
    patch: SceneTransformPatch = {}
  ): void {
    const actor = this.#actors.get(id);
    const file = this.#document.tree.peekActor(id);
    if (actor === undefined || file === undefined) {
      return;
    }

    this.#builder.writeActor(actor, {
      ...file,
      transform: {
        ...file.transform,
        ...patch
      }
    });
  }

  #removeComponent(
    id: string
  ): void {
    this.#components.get(id)?.component.destroy();
    this.#forgetComponent(id);
  }

  #rebuildComponent(
    id: string
  ): void {
    this.#removeComponent(id);

    const entry = this.#document.tree.component(id);
    const ownerId = this.#document.tree.componentOwner(id);
    const actor = ownerId === undefined ? undefined : this.#actors.get(ownerId);
    if (entry === undefined || ownerId === undefined || actor === undefined) {
      return;
    }

    const component = this.#builder.createComponent(actor, entry);
    if (component !== null) {
      this.#bindComponent(id, component, ownerId);
    }
  }

  #changeComponent(
    id: string
  ): void {
    if (!this.#applyComponent(id, {})) {
      this.#rebuildComponent(id);
    }
  }

  #applyComponent(
    id: string,
    change: ComponentChange
  ): boolean {
    const component = this.#components.get(id)?.component;
    const entry = this.#document.tree.component(id);
    const definition = entry === undefined ?
      null :
      this.#definitions.find(entry.type);
    if (
      component === undefined ||
      entry === undefined ||
      definition?.apply === undefined
    ) {
      return false;
    }

    definition.apply(
      component,
      definition.parse(applyComponentChange(entry.data, change))
    );

    return true;
  }
}
