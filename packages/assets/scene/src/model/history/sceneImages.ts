// Import Internal Dependencies
import type { SceneTreeReader } from "../SceneTree.ts";
import type {
  SceneActorJSON,
  SceneCommand,
  SceneEnvironmentJSON,
  SceneSnapshot
} from "../../network/types.ts";

export interface SceneImages {
  readonly actors: readonly SceneActorJSON[];
  readonly environment: SceneEnvironmentJSON | null;
}

export interface SceneImage {
  readonly before: SceneImages;
  readonly order: readonly string[];
}

export function captureSceneImage(
  tree: SceneTreeReader,
  command: SceneCommand
): SceneImage {
  return {
    before: captureBefore(tree, command),
    order: [...tree.actorIds()]
  };
}

export function restoreSceneImages(
  tree: SceneTreeReader,
  images: readonly SceneImage[]
): SceneSnapshot {
  const entries = new Map(
    Array.from(tree.actors(), (actor) => [actor.id, actor])
  );
  let environment = tree.environment;
  for (const { before } of [...images].reverse()) {
    for (const actor of before.actors) {
      entries.set(actor.id, actor);
    }
    environment = before.environment ?? environment;
  }
  const order = images.at(0)?.order ?? [...entries.keys()];

  return {
    environment,
    actors: inTreeOrder(order.flatMap((id) => entries.get(id) ?? []))
  };
}

function captureBefore(
  tree: SceneTreeReader,
  command: SceneCommand
): SceneImages {
  switch (command.action) {
    case "actor-added":
      return nothingBefore();
    case "actor-removed":
      return actorsBefore(tree.subtreeFrom(command.id));
    case "actor-moved":
    case "actor-renamed":
    case "actor-visibility":
    case "actor-transformed":
      return actorsBefore(present(tree.actor(command.id)));
    case "component-added":
    case "component-removed":
    case "component-moved":
      return actorsBefore(present(tree.actor(command.actorId)));
    case "component-changed":
    case "component-assets-changed": {
      const ownerId = tree.componentOwner(command.id);

      return actorsBefore(ownerId === undefined ? [] : present(tree.actor(ownerId)));
    }
    case "environment-changed":
      return {
        actors: [],
        environment: tree.environment
      };
  }
}

function inTreeOrder(
  actors: readonly SceneActorJSON[]
): SceneActorJSON[] {
  const byParent = Map.groupBy(actors, (actor) => actor.parentId);
  const ordered: SceneActorJSON[] = [];
  const pending = [...(byParent.get(null) ?? [])].reverse();
  for (let actor = pending.pop(); actor !== undefined; actor = pending.pop()) {
    ordered.push(actor);
    pending.push(...[...(byParent.get(actor.id) ?? [])].reverse());
  }

  return ordered;
}

function nothingBefore(): SceneImages {
  return actorsBefore([]);
}

function actorsBefore(
  actors: readonly SceneActorJSON[]
): SceneImages {
  return {
    actors,
    environment: null
  };
}

function present<T>(
  value: T | undefined
): T[] {
  return value === undefined ? [] : [value];
}
