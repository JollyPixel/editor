// Import Internal Dependencies
import type {
  JSONObject,
  SceneActorJSON,
  SceneCommand,
  SceneComponentJSON,
  SceneEnvironmentJSON,
  SceneSnapshot
} from "../network/types.ts";
import { ActorHierarchy } from "./ActorHierarchy.ts";
import { applyComponentChange } from "./componentChange.ts";
import {
  InvalidSceneTreeError,
  type SceneTreeEntry
} from "./errors/InvalidSceneTreeError.ts";
import { createSceneEnvironment } from "./sceneEnvironment.ts";
import {
  findNextId,
  slotIndex
} from "./siblingSlots.ts";
import { copySubtree } from "./subtreeCopy.ts";

// CONSTANTS
export const COMPONENT_DATA_MAX_LENGTH = 65_536;

export type SceneTreeReader = Pick<
  SceneTree,
  | "size"
  | "environment"
  | "has"
  | "actor"
  | "peekActor"
  | "actors"
  | "actorIds"
  | "ancestorIds"
  | "findNextSibling"
  | "subtreeFrom"
  | "copySubtree"
  | "topmostIds"
  | "component"
  | "peekComponent"
  | "componentOwner"
  | "findNextComponent"
  | "erasedBy"
  | "toJSON"
>;

interface TreeProblem {
  entry: SceneTreeEntry;
  id: string;
  reason: string;
}

interface ActorListContext {
  hasActor(id: string): boolean;
  hasComponent(id: string): boolean;
  isOuterParent(actor: SceneActorJSON, index: number): boolean;
}

export class SceneTree {
  #actors = new ActorHierarchy();
  #owners = new Map<string, string>();
  #environment: SceneEnvironmentJSON = createSceneEnvironment();

  get size(): number {
    return this.#actors.size;
  }

  get environment(): SceneEnvironmentJSON {
    return structuredClone(this.#environment);
  }

  has(
    id: string
  ): boolean {
    return this.#actors.has(id);
  }

  actor(
    id: string
  ): SceneActorJSON | undefined {
    const actor = this.#actors.peek(id);

    return actor === undefined ? undefined : structuredClone(actor);
  }

  peekActor(
    id: string
  ): Readonly<SceneActorJSON> | undefined {
    return this.#actors.peek(id);
  }

  * actors(): IterableIterator<SceneActorJSON> {
    for (const actor of this.#actors.walk(null)) {
      yield structuredClone(actor);
    }
  }

  * actorIds(): IterableIterator<string> {
    for (const actor of this.#actors.walk(null)) {
      yield actor.id;
    }
  }

  ancestorIds(
    id: string
  ): IterableIterator<string> {
    return this.#actors.ancestorIds(id);
  }

  findNextSibling(
    id: string
  ): string | undefined {
    return this.#actors.findNextSibling(id);
  }

  subtreeFrom(
    id: string
  ): SceneActorJSON[] {
    return this.#actors.subtreeFrom(id).map((actor) => structuredClone(actor));
  }

  copySubtree(
    id: string
  ): SceneActorJSON[] {
    return copySubtree(this.#actors.subtreeFrom(id));
  }

  topmostIds(
    ids: Iterable<string>
  ): string[] {
    const wanted = new Set(ids);

    return [...this.#actors.walk(null)]
      .map((actor) => actor.id)
      .filter((id) => wanted.has(id) &&
        ![...this.#actors.ancestorIds(id)].some((parentId) => wanted.has(parentId)));
  }

  component(
    id: string
  ): SceneComponentJSON | undefined {
    const component = this.peekComponent(id);

    return component === undefined ? undefined : structuredClone(component);
  }

  peekComponent(
    id: string
  ): Readonly<SceneComponentJSON> | undefined {
    return this.#peekOwner(id)?.components.find(
      (component) => component.id === id
    );
  }

  componentOwner(
    id: string
  ): string | undefined {
    return this.#owners.get(id);
  }

  findNextComponent(
    id: string
  ): string | undefined {
    const owner = this.#peekOwner(id);
    if (owner === undefined) {
      return undefined;
    }

    return findNextId(owner.components.map((component) => component.id), id);
  }

  erasedBy(
    command: SceneCommand
  ): Readonly<SceneActorJSON>[] {
    switch (command.action) {
      case "actor-removed":
        return this.#actors.subtreeFrom(command.id);
      case "component-removed": {
        const owner = this.#actors.peek(command.actorId);

        return owner === undefined ? [] : [owner];
      }
      default:
        return [];
    }
  }

  placeable(
    command: SceneCommand
  ): SceneCommand {
    if (!("beforeId" in command) || this.#hasSlot(command)) {
      return command;
    }

    const { beforeId: _beforeId, ...placed } = command;

    return placed;
  }

  accepts(
    command: SceneCommand
  ): boolean {
    if (!this.#hasSlot(command)) {
      return false;
    }

    switch (command.action) {
      case "actor-added":
        return this.#canAdd(command.actors);
      case "actor-removed":
      case "actor-renamed":
      case "actor-visibility":
      case "actor-transformed":
        return this.#actors.has(command.id);
      case "actor-moved":
        return this.#actors.has(command.id) &&
          this.#actors.isParent(command.parentId) &&
          !this.#actors.isWithin(command.parentId, command.id);
      case "component-added":
        return this.#actors.has(command.actorId) &&
          !this.#owners.has(command.component.id) &&
          fitsDataLimit(command.component.data);
      case "component-removed":
      case "component-moved":
        return this.#owners.get(command.id) === command.actorId;
      case "component-changed":
        return this.#canChangeComponent(command);
      case "component-assets-changed":
        return this.#owners.has(command.id);
      case "environment-changed":
        return true;
    }
  }

  apply(
    command: SceneCommand
  ): void {
    switch (command.action) {
      case "actor-added":
        this.#insert(command.actors, command.beforeId);
        break;

      case "actor-removed":
        for (const actor of this.#actors.remove(command.id)) {
          for (const component of actor.components) {
            this.#owners.delete(component.id);
          }
        }
        break;

      case "actor-moved":
        this.#actors.move(command.id, command.parentId, command.beforeId);
        this.#actors.update(command.id, (actor) => {
          return {
            ...actor,
            transform: structuredClone(command.transform)
          };
        });
        break;

      case "actor-renamed":
        this.#actors.update(command.id, (actor) => {
          return {
            ...actor,
            name: command.name
          };
        });
        break;

      case "actor-visibility":
        this.#actors.update(command.id, (actor) => {
          return {
            ...actor,
            visible: command.visible
          };
        });
        break;

      case "actor-transformed":
        this.#actors.update(command.id, (actor) => {
          return {
            ...actor,
            transform: {
              ...actor.transform,
              ...structuredClone(command.transform)
            }
          };
        });
        break;

      case "component-added":
        this.#actors.update(command.actorId, (actor) => {
          return {
            ...actor,
            components: insertedBefore(
              actor.components,
              structuredClone(command.component),
              command.beforeId
            )
          };
        });
        this.#owners.set(command.component.id, command.actorId);
        break;

      case "component-removed":
        this.#actors.update(command.actorId, (actor) => {
          return {
            ...actor,
            components: actor.components.filter(({ id }) => id !== command.id)
          };
        });
        this.#owners.delete(command.id);
        break;

      case "component-moved":
        this.#actors.update(command.actorId, (actor) => {
          const moved = actor.components.find(({ id }) => id === command.id);

          return moved === undefined ? actor : {
            ...actor,
            components: insertedBefore(
              actor.components.filter(({ id }) => id !== command.id),
              moved,
              command.beforeId
            )
          };
        });
        break;

      case "component-changed":
        this.#updateComponent(command.id, (component) => {
          return {
            ...component,
            data: applyComponentChange(component.data, command)
          };
        });
        break;

      case "component-assets-changed":
        this.#updateComponent(command.id, (component) => {
          return {
            ...component,
            assets: {
              ...component.assets,
              ...structuredClone(command.assets)
            }
          };
        });
        break;

      case "environment-changed":
        this.#environment = {
          ...this.#environment,
          ...structuredClone(command.environment)
        };
        break;
    }
  }

  load(
    snapshot: SceneSnapshot
  ): void {
    const problem = findActorListProblem(snapshot.actors, {
      hasActor: () => false,
      hasComponent: () => false,
      isOuterParent: (actor) => actor.parentId === null
    });
    if (problem !== null) {
      throw new InvalidSceneTreeError(problem.entry, problem.id, problem.reason);
    }

    this.clear();
    this.#environment = structuredClone(snapshot.environment);
    this.#insert(snapshot.actors, undefined);
  }

  clear(): void {
    this.#actors.clear();
    this.#owners.clear();
    this.#environment = createSceneEnvironment();
  }

  toJSON(): SceneSnapshot {
    return {
      environment: this.environment,
      actors: [...this.actors()]
    };
  }

  #peekOwner(
    componentId: string
  ): Readonly<SceneActorJSON> | undefined {
    const ownerId = this.#owners.get(componentId);

    return ownerId === undefined ? undefined : this.#actors.peek(ownerId);
  }

  #hasSlot(
    command: SceneCommand
  ): boolean {
    switch (command.action) {
      case "actor-added": {
        const [root] = command.actors;

        return root !== undefined &&
          this.#actors.isSiblingSlot(command.beforeId, root.parentId, root.id);
      }
      case "actor-moved":
        return this.#actors.isSiblingSlot(command.beforeId, command.parentId, command.id);
      case "component-added":
        return this.#isComponentSlot(command.beforeId, command.actorId, command.component.id);
      case "component-moved":
        return this.#isComponentSlot(command.beforeId, command.actorId, command.id);
      default:
        return true;
    }
  }

  #isComponentSlot(
    beforeId: string | undefined,
    actorId: string,
    id: string
  ): boolean {
    return beforeId === undefined || (
      beforeId !== id &&
      this.#owners.get(beforeId) === actorId
    );
  }

  #canAdd(
    actors: readonly SceneActorJSON[]
  ): boolean {
    return actors.length > 0 && findActorListProblem(actors, {
      hasActor: (id) => this.#actors.has(id),
      hasComponent: (id) => this.#owners.has(id),
      isOuterParent: (actor, index) => index === 0 && this.#actors.isParent(actor.parentId)
    }) === null;
  }

  #canChangeComponent(
    command: Extract<SceneCommand, { action: "component-changed"; }>
  ): boolean {
    const component = this.peekComponent(command.id);
    const unset = command.unset ?? [];
    const keys = Object.keys(command.data);
    if (
      component === undefined ||
      keys.length + unset.length === 0 ||
      unset.some((key) => Object.hasOwn(command.data, key))
    ) {
      return false;
    }

    return fitsDataLimit(applyComponentChange(component.data, command));
  }

  #insert(
    actors: readonly SceneActorJSON[],
    beforeId: string | undefined
  ): void {
    for (const [index, actor] of actors.entries()) {
      this.#actors.insert(actor, index === 0 ? beforeId : undefined);
      for (const component of actor.components) {
        this.#owners.set(component.id, actor.id);
      }
    }
  }

  #updateComponent(
    id: string,
    change: (component: SceneComponentJSON) => SceneComponentJSON
  ): void {
    const ownerId = this.#owners.get(id);
    if (ownerId === undefined) {
      return;
    }

    this.#actors.update(ownerId, (actor) => {
      return {
        ...actor,
        components: actor.components.map(
          (component) => (component.id === id ? change(component) : component)
        )
      };
    });
  }
}

function fitsDataLimit(
  data: JSONObject
): boolean {
  return JSON.stringify(data).length <= COMPONENT_DATA_MAX_LENGTH;
}

function findActorListProblem(
  actors: readonly SceneActorJSON[],
  context: ActorListContext
): TreeProblem | null {
  const actorIds = new Set<string>();
  const componentIds = new Set<string>();
  for (const [index, actor] of actors.entries()) {
    if (context.hasActor(actor.id) || actorIds.has(actor.id)) {
      return problem("actor", actor.id, "is listed twice");
    }
    if (actor.prefab !== undefined) {
      return problem("actor", actor.id, "is a prefab instance");
    }
    const listedParent = actor.parentId !== null && actorIds.has(actor.parentId);
    if (!listedParent && !context.isOuterParent(actor, index)) {
      return problem("actor", actor.id, `has no parent ${actor.parentId} before it`);
    }
    actorIds.add(actor.id);

    for (const component of actor.components) {
      if (context.hasComponent(component.id) || componentIds.has(component.id)) {
        return problem("component", component.id, "is listed twice");
      }
      if (!fitsDataLimit(component.data)) {
        return problem(
          "component",
          component.id,
          `has data over ${COMPONENT_DATA_MAX_LENGTH} characters`
        );
      }
      componentIds.add(component.id);
    }
  }

  return null;
}

function problem(
  entry: SceneTreeEntry,
  id: string,
  reason: string
): TreeProblem {
  return {
    entry,
    id,
    reason
  };
}

function insertedBefore<T extends { id: string; }>(
  entries: readonly T[],
  entry: T,
  beforeId: string | undefined
): T[] {
  const placed = [...entries];
  placed.splice(slotIndex(entries.map(({ id }) => id), beforeId), 0, entry);

  return placed;
}
