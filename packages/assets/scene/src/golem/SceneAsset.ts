// Import Third-party Dependencies
import { GolemAsset } from "@jolly-pixel/golem.kit";
import type { PeerMetadata } from "@jolly-pixel/network/client";

// Import Internal Dependencies
import {
  SCENE_SELECTION_PRESENCE_KEY,
  sceneCommandActor,
  type SceneCommand,
  type SceneComponentJSON,
  type SceneEnvironmentJSON,
  type SceneSnapshot,
  type SceneTreeReader,
  type SyncedSceneDocument
} from "../network/client.ts";
import { SceneComponentTypes } from "./SceneComponentTypes.ts";
import {
  actorList,
  componentJSON,
  type AddedActor
} from "./ActorSpec.ts";
import type {
  AddActorsInput,
  AddComponentsInput,
  MoveActorsInput,
  RemoveActorsInput,
  TransformActorsInput,
  UseEnvironmentInput
} from "./SceneInputs.ts";
import { SceneRefs } from "./SceneRefs.ts";

export interface AddedComponent {
  id: string;
  type: string;
}

export class SceneAsset extends GolemAsset<
  SceneCommand,
  SyncedSceneDocument
> {
  #refs = new SceneRefs(this.tree, this.studio.catalog);
  #components = SceneComponentTypes.parse(this.studio.editors);

  get tree(): SceneTreeReader {
    return this.synced.document.tree;
  }

  read(): SceneSnapshot {
    return this.tree.toJSON();
  }

  async addActors(
    input: AddActorsInput
  ): Promise<AddedActor[]> {
    const parentId = this.#parent(input.parentId ?? null);
    const lists = input.actors.map(
      (spec) => actorList(spec, parentId, this.#refs)
    );
    await this.applyInBatches(lists.map((actors): SceneCommand => {
      return {
        action: "actor-added",
        actors
      };
    }));

    return lists.flat().map(({ id, name }) => {
      return {
        id,
        name
      };
    });
  }

  async transformActors(
    input: TransformActorsInput
  ): Promise<void> {
    await this.applyInBatches(input.changes.map((change): SceneCommand => {
      return {
        action: "actor-transformed",
        id: this.#refs.actor(change.actor),
        transform: change.transform
      };
    }));
  }

  async moveActors(
    input: MoveActorsInput
  ): Promise<void> {
    const parentId = this.#parent(input.parent);
    const beforeId = input.before === undefined ?
      undefined :
      this.#refs.actor(input.before);
    await this.applyInBatches(input.actors.map((actor): SceneCommand => {
      const id = this.#refs.actor(actor);

      return {
        action: "actor-moved",
        id,
        parentId,
        transform: this.tree.actor(id)!.transform,
        ...beforeId === undefined ? {} : { beforeId }
      };
    }));
  }

  async removeActors(
    input: RemoveActorsInput
  ): Promise<void> {
    const ids = input.actors.map((actor) => this.#refs.actor(actor));
    await this.applyInBatches(
      this.tree.topmostIds(ids).map((id): SceneCommand => {
        return {
          action: "actor-removed",
          id
        };
      })
    );
  }

  async addComponents(
    input: AddComponentsInput
  ): Promise<AddedComponent[]> {
    const { actor } = input;
    const actorId = this.#refs.actor(actor);
    if (!this.tree.canHoldComponents(actorId)) {
      throw new TypeError(
        `Actor ${JSON.stringify(actor)} is a prefab instance: it cannot ` +
        "take components."
      );
    }

    const components = input.components.map(
      (spec) => componentJSON(spec, this.#refs)
    );
    await this.applyInBatches(components.map((component): SceneCommand => {
      return {
        action: "component-added",
        actorId,
        component
      };
    }));

    return components.map(({ id, type }) => {
      return {
        id,
        type
      };
    });
  }

  async useEnvironment(
    input: UseEnvironmentInput
  ): Promise<SceneEnvironmentJSON> {
    const environment = this.#refs.environment(input.environment);
    await this.apply([{
      action: "environment-changed",
      environment
    }]);

    return environment;
  }

  protected override guard(
    commands: readonly SceneCommand[]
  ): void {
    const added = new Map<string, string>();
    const check = (component: SceneComponentJSON) => {
      this.#components.assertValid(component.type, component.assets);
      added.set(component.id, component.type);
    };
    for (const command of commands) {
      switch (command.action) {
        case "actor-added":
          command.actors.forEach(({ components }) => components.forEach(check));
          break;
        case "component-added":
          check(command.component);
          break;
        case "component-assets-changed": {
          const type = added.get(command.id) ??
            this.tree.component(command.id)?.type;
          if (type !== undefined) {
            this.#components.assertValid(type, command.assets);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  protected focus(
    commands: readonly SceneCommand[]
  ): PeerMetadata | null {
    for (const command of commands.toReversed()) {
      const actorId = sceneCommandActor(this.tree, command);
      if (actorId !== null && this.tree.has(actorId)) {
        return { [SCENE_SELECTION_PRESENCE_KEY]: actorId };
      }
    }

    return null;
  }

  #parent(
    nameOrId: string | null
  ): string | null {
    const parentId = nameOrId === null ? null : this.#refs.actor(nameOrId);
    if (!this.tree.canContain(parentId)) {
      throw new TypeError(
        `Actor ${JSON.stringify(nameOrId)} is a prefab instance: it cannot ` +
        "hold children."
      );
    }

    return parentId;
  }
}
