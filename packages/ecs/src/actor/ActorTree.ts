// Import Internal Dependencies
import type {
  WorldDefaultContext
} from "../systems/World.ts";
import {
  compileSegment,
  compileWildcard,
  type SegmentMatcher
} from "../utils/glob.ts";
import type { Actor } from "./Actor.ts";

export type ActorTreeNode<
  TContext = WorldDefaultContext
> = {
  actor: Actor<TContext>;
  parent?: Actor<TContext>;
};

type ActorLink = (
  tree: ActorTree<any>,
  actor: Actor<any>
) => void;

let link: ActorLink;
let unlink: ActorLink;

export class ActorTree<
  TContext = WorldDefaultContext
> {
  static {
    link = (tree, actor) => {
      tree.#children.push(actor);
    };
    unlink = (tree, actor) => {
      const index = tree.#children.indexOf(actor);
      if (index !== -1) {
        tree.#children.splice(index, 1);
      }
    };
  }

  #children: Actor<TContext>[] = [];

  get children(): readonly Actor<TContext>[] {
    return this.#children;
  }

  * findActors(
    pattern: string
  ): IterableIterator<Actor<TContext>> {
    if (pattern.includes("/")) {
      const matchers = splitPath(pattern).map(compileSegment);
      yield* matchPath(this.children, matchers, 0);

      return;
    }

    const isPatternMatching = compileWildcard(pattern);

    for (const { actor } of this.walk()) {
      if (isPatternMatching(actor.name) && !actor.pendingForDestruction) {
        yield actor;
      }
    }
  }

  findActor(
    name: string
  ): Actor<TContext> | null {
    if (name.includes("/")) {
      return this.#findActorByPath(name);
    }

    for (const { actor } of this.walk()) {
      if (actor.name === name && !actor.pendingForDestruction) {
        return actor;
      }
    }

    return null;
  }

  #findActorByPath(
    path: string
  ): Actor<TContext> | null {
    let candidates: readonly Actor<TContext>[] = this.children;
    let current: Actor<TContext> | null = null;

    for (const part of splitPath(path)) {
      current = candidates.find(
        (child) => child.name === part && !child.pendingForDestruction
      ) ?? null;
      if (current === null) {
        return null;
      }
      candidates = current.children;
    }

    return current;
  }

  * walk(): IterableIterator<ActorTreeNode<TContext>> {
    for (const child of this.children) {
      yield* walkDepthFirst(child);
    }
  }

  * [Symbol.iterator](): IterableIterator<Actor<TContext>> {
    for (const rootActor of this.children) {
      if (!rootActor.pendingForDestruction) {
        yield rootActor;
      }
    }
  }
}

function splitPath(
  path: string
): string[] {
  return path.split("/").filter((part) => part !== "");
}

function* walkDepthFirst<TContext>(
  node: Actor<TContext>
): IterableIterator<ActorTreeNode<TContext>> {
  yield {
    actor: node,
    parent: node.parent ?? undefined
  };

  for (const child of node.children) {
    yield* walkDepthFirst(child);
  }
}

function* matchPath<TContext>(
  candidates: Iterable<Actor<TContext>>,
  matchers: SegmentMatcher[],
  index: number
): IterableIterator<Actor<TContext>> {
  const matcher = matchers[index];
  const isLast = index === matchers.length - 1;

  for (const candidate of candidates) {
    if (candidate.pendingForDestruction) {
      continue;
    }

    if (matcher === "**") {
      for (const { actor } of walkDepthFirst(candidate)) {
        if (actor.pendingForDestruction) {
          continue;
        }

        if (isLast) {
          yield actor;
        }
        else {
          yield* matchPath([actor], matchers, index + 1);
        }
      }
    }
    else if (matcher(candidate.name)) {
      if (isLast) {
        yield candidate;
      }
      else {
        yield* matchPath(candidate.children, matchers, index + 1);
      }
    }
  }
}

export {
  link as linkActor,
  unlink as unlinkActor
};
