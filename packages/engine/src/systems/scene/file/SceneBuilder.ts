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
  SceneComponentFile
} from "./SceneFile.ts";
import { writeSceneTransform } from "./sceneTransform.ts";

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

      this.#buildActor(file, actorParent, builtActors, builtComponents);
    }

    return new SceneBuild(builtActors, builtComponents);
  }

  buildActor(
    file: SceneActorFile,
    parent: Actor<TContext> | null
  ): SceneBuild<TContext> {
    const builtActors = new Map<string, Actor<TContext>>();
    const builtComponents = new Map<string, Component>();
    this.#buildActor(file, parent, builtActors, builtComponents);

    return new SceneBuild(builtActors, builtComponents);
  }

  writeActor(
    actor: Actor<TContext>,
    file: Pick<SceneActorFile, "name" | "visible" | "transform">
  ): void {
    actor.name = file.name;
    actor.object3D.visible = file.visible;
    writeSceneTransform(actor.object3D, file.transform);
  }

  createComponent(
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

  #buildActor(
    file: SceneActorFile,
    parent: Actor<TContext> | null,
    builtActors: Map<string, Actor<TContext>>,
    builtComponents: Map<string, Component>
  ): void {
    const actor = new Actor<TContext>(this.#world, {
      name: file.name,
      parent,
      visible: file.visible
    });
    writeSceneTransform(actor.object3D, file.transform);
    builtActors.set(file.id, actor);

    for (const entry of file.components) {
      const component = this.createComponent(actor, entry);
      if (component !== null) {
        builtComponents.set(entry.id, component);
      }
    }
  }
}
