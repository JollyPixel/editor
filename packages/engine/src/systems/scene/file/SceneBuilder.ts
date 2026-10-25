// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor } from "../../../actor/Actor.ts";
import type { Component } from "../../../components/types.ts";
import type { World, WorldDefaultContext } from "../../World.ts";
import type { Logger } from "../../Logger.ts";
import {
  type ComponentAssetResolver,
  type SceneMode,
  ComponentAssets
} from "./ComponentDefinition.ts";
import type { ComponentDefinitions } from "./ComponentDefinitions.ts";
import { SceneBuild } from "./SceneBuild.ts";
import type {
  SceneActorFile,
  SceneComponentFile,
  SceneTransformFile
} from "./SceneFile.ts";

export interface SceneBuilderOptions<
  TContext = WorldDefaultContext
> {
  world: World<any, TContext>;
  mode: SceneMode;
  components: ComponentDefinitions;
  assets: ComponentAssetResolver;
}

export class SceneBuilder<
  TContext = WorldDefaultContext
> {
  #world: World<any, TContext>;
  #mode: SceneMode;
  #components: ComponentDefinitions;
  #assets: ComponentAssetResolver;
  #logger: Logger;

  constructor(
    options: SceneBuilderOptions<TContext>
  ) {
    this.#world = options.world;
    this.#mode = options.mode;
    this.#components = options.components;
    this.#assets = options.assets;
    this.#logger = options.world.logger.child({
      namespace: "Systems.SceneBuilder"
    });
  }

  build(
    actors: Iterable<SceneActorFile>,
    parent: Actor<TContext> | null = null
  ): SceneBuild<TContext> {
    const builtActors = new Map<string, Actor<TContext>>();
    const builtComponents = new Map<string, Component>();

    for (const file of actors) {
      if (builtActors.has(file.id)) {
        this.#logger.warn("Duplicate actor id skipped", { id: file.id });
        continue;
      }

      const actorParent = file.parentId === null ?
        parent :
        builtActors.get(file.parentId);
      if (actorParent === undefined) {
        this.#logger.warn("Actor without a built parent skipped", {
          id: file.id,
          parentId: file.parentId
        });
        continue;
      }

      const actor = new Actor<TContext>(this.#world, {
        name: file.name,
        parent: actorParent,
        visible: file.visible
      });
      writeTransform(actor.object3D, file.transform);
      builtActors.set(file.id, actor);

      for (const entry of file.components) {
        const component = this.#createComponent(actor, entry);
        if (component !== null) {
          builtComponents.set(entry.id, component);
        }
      }
    }

    return new SceneBuild(builtActors, builtComponents);
  }

  #createComponent(
    actor: Actor<TContext>,
    entry: SceneComponentFile
  ): Component | null {
    const definition = this.#components.find(entry.type);
    if (definition === null) {
      if (this.#mode === "play") {
        this.#logger.warn("Unknown component type skipped", {
          type: entry.type,
          actor: actor.name
        });
      }

      return null;
    }

    return definition.create(
      actor,
      definition.parse(entry.data),
      {
        mode: this.#mode,
        assets: new ComponentAssets(
          definition.assets ?? {},
          entry.assets,
          this.#assets
        )
      }
    );
  }
}

function writeTransform(
  object: THREE.Object3D,
  transform: SceneTransformFile
): void {
  const { position, rotation, scale } = transform;

  object.position.set(position.x, position.y, position.z);
  object.rotation.set(
    THREE.MathUtils.degToRad(rotation.x),
    THREE.MathUtils.degToRad(rotation.y),
    THREE.MathUtils.degToRad(rotation.z)
  );
  object.scale.set(scale.x, scale.y, scale.z);
  object.updateMatrixWorld(false);
}
