// Import Internal Dependencies
import { ownedCopy } from "../ownedCopy.ts";
import { SceneFootprint } from "../footprint/SceneFootprint.ts";
import type { SceneTreeReader } from "../tree/SceneTree.ts";
import type {
  SceneActorView,
  SceneCommand,
  SceneSnapshot
} from "../../network/types.ts";

export interface SceneImage {
  readonly before: SceneFootprint;
  readonly order: readonly string[];
}

export function captureSceneImage(
  tree: SceneTreeReader,
  command: SceneCommand
): SceneImage {
  return {
    before: SceneFootprint.capture(tree, command),
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

  return ownedCopy({
    environment,
    actors: inTreeOrder(order.flatMap((id) => entries.get(id) ?? []))
  });
}

function inTreeOrder(
  actors: readonly SceneActorView[]
): SceneActorView[] {
  const byParent = Map.groupBy(actors, (actor) => actor.parentId);
  const ordered: SceneActorView[] = [];
  const pending = [...(byParent.get(null) ?? [])].reverse();
  for (let actor = pending.pop(); actor !== undefined; actor = pending.pop()) {
    ordered.push(actor);
    pending.push(...[...(byParent.get(actor.id) ?? [])].reverse());
  }

  return ordered;
}
