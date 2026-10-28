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
  type SceneAnchorJSON,
  type SceneChange,
  type SceneDocument,
  type SceneEnvironmentJSON,
  type SceneEnvironmentPatch,
  type SceneTransformPatch
} from "@jolly-pixel/asset.scene/client";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { PrefabScenes } from "./PrefabScenes.ts";

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
  prefabs: Pick<PrefabScenes, "find" | "subscribe">;
  sceneId: string;
}

export interface BoundComponent {
  component: Component;
  actorId: string;
}

export type SceneBindingEvents = {
  actorsChange: () => void;
  componentBuilt: (bound: BoundComponent) => void;
  componentDropped: (component: Component) => void;
  anchorsChange: () => void;
};

export class SceneBinding
  extends Emitter<SceneBindingEvents>
  implements Systems.SceneAnchorsReader {
  #world: Systems.World;
  #document: SceneDocument;
  #instance: Systems.SceneInstance;
  #environment: SceneEnvironmentTarget;
  #pickTargets = new Map<THREE.Object3D, string>();
  #unsubscribePrefabs: () => void;

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

  #onPrefabChange = (
    sceneId: string
  ): void => {
    this.#instance.refresh(sceneId);
    this.#forgetPickTargets();
    this.emit("actorsChange");
    this.#world.invalidate();
  };

  constructor(
    options: SceneBindingOptions
  ) {
    super();
    this.#world = options.world;
    this.#document = options.document;
    this.#environment = options.environment;
    this.#instance = new Systems.SceneInstance({
      world: options.world,
      mode: "edit",
      components: options.components,
      assets: options.assets,
      prefabs: options.prefabs,
      sceneId: options.sceneId
    });
    this.#instance.on("componentBuilt", (built) => {
      this.emit("componentBuilt", built);
    });
    this.#instance.on("componentDropped", (component) => {
      this.emit("componentDropped", component);
    });
    this.#instance.on("anchorsChange", () => {
      this.emit("anchorsChange");
      this.#world.invalidate();
    });

    this.#rebuild();
    this.#document.on("change", this.#onChange);
    this.#document.on("reset", this.#onReset);
    this.#unsubscribePrefabs = options.prefabs.subscribe(
      "change",
      this.#onPrefabChange
    );
  }

  actor(
    id: string
  ): Actor | null {
    return this.#instance.actor(id);
  }

  component(
    id: string
  ): Component | null {
    return this.#instance.component(id);
  }

  components(): IterableIterator<BoundComponent> {
    return this.#instance.components();
  }

  anchors(
    actorId: string
  ): IterableIterator<Systems.SceneActorAnchor> {
    return this.#instance.anchors(actorId);
  }

  findAnchor(
    actorId: string,
    anchor: SceneAnchorJSON
  ): Systems.ComponentAnchor | null {
    return this.#instance.findAnchor(actorId, anchor);
  }

  worldBounds(
    ids: Iterable<string>
  ): THREE.Box3 {
    const bounds = new THREE.Box3();
    for (const id of ids) {
      const object = this.#instance.actor(id)?.object3D;
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
      const id = this.#instance.actorId(current) ??
        this.#pickTargets.get(current);
      if (id !== undefined) {
        return this.#documentActorId(id);
      }
      current = current.parent;
    }

    return null;
  }

  addPickTarget(
    object: THREE.Object3D,
    actorId: string
  ): () => void {
    this.#pickTargets.set(object, actorId);

    return () => {
      if (this.#pickTargets.get(object) === actorId) {
        this.#pickTargets.delete(object);
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
    this.#unsubscribePrefabs();
    this.#clear();
  }

  #documentActorId(
    id: string
  ): string | null {
    let current: THREE.Object3D | null = this.#instance.actor(id)?.object3D ?? null;
    while (current !== null) {
      const actorId = this.#instance.actorId(current);
      if (actorId !== null && this.#document.tree.has(actorId)) {
        return actorId;
      }
      current = current.parent;
    }

    return null;
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
        this.#instance.remove(command.id);
        this.#forgetPickTargets();
        this.emit("actorsChange");
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
        this.#instance.removeComponent(command.id);
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
    this.#instance.clear();
    this.#pickTargets.clear();
  }

  #buildActors(
    ids: Iterable<string>
  ): void {
    const { tree } = this.#document;
    const files: SceneActorJSON[] = [];
    for (const id of ids) {
      const file = tree.actor(id);
      if (file !== undefined) {
        files.push(file);
      }
    }

    this.#instance.add(files);
    this.emit("actorsChange");
  }

  #forgetPickTargets(): void {
    for (const [object, id] of this.#pickTargets) {
      if (this.#instance.actor(id) === null) {
        this.#pickTargets.delete(object);
      }
    }
  }

  #reparent(
    id: string
  ): void {
    const file = this.#document.tree.peekActor(id);
    if (file !== undefined) {
      this.#instance.reparent(id, file.parentId, file.anchor);
      this.#syncActor(id);
    }
  }

  #syncActor(
    id: string,
    patch: SceneTransformPatch = {}
  ): void {
    const file = this.#document.tree.peekActor(id);
    if (file === undefined) {
      return;
    }

    this.#instance.write(id, {
      ...file,
      transform: {
        ...file.transform,
        ...patch
      }
    });
  }

  #rebuildComponent(
    id: string
  ): void {
    const entry = this.#document.tree.component(id);
    const ownerId = this.#document.tree.componentOwner(id);
    if (entry === undefined || ownerId === undefined) {
      this.#instance.removeComponent(id);

      return;
    }

    this.#instance.rebuildComponent(ownerId, entry);
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
    const entry = this.#document.tree.component(id);

    return entry !== undefined && this.#instance.applyComponent(
      id,
      entry.type,
      applyComponentChange(entry.data, change)
    );
  }
}
