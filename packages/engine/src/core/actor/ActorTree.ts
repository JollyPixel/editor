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

export interface ActorTreeOptions<
  TContext = WorldDefaultContext
> {
  addCallback?: (actor: Actor<TContext>) => void;
  removeCallback?: (actor: Actor<TContext>) => void;
}

export class ActorTree<
  TContext = WorldDefaultContext
> {
  #addCallback?: (actor: Actor<TContext>) => void;
  #removeCallback?: (actor: Actor<TContext>) => void;

  children: Actor<TContext>[] = [];

  constructor(
    options: ActorTreeOptions<TContext> = {}
  ) {
    this.#addCallback = options.addCallback;
    this.#removeCallback = options.removeCallback;
  }

  add(
    actor: Actor<TContext>
  ): void {
    this.children.push(actor);
    this.#addCallback?.(actor);
  }

  remove(actor: Actor<TContext>): void {
    const index = this.children.indexOf(actor);
    if (index !== -1) {
      this.children.splice(index, 1);
      this.#removeCallback?.(actor);
    }
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
    let candidates: Actor<TContext>[] = this.children;
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

  destroyActor(
    actor: Actor<TContext>
  ) {
    if (!actor.pendingForDestruction) {
      actor.markDestructionPending();
    }
  }

  destroyAllActors() {
    for (const { actor } of this.walk()) {
      this.destroyActor(actor);
    }
  }

  * walk(): IterableIterator<ActorTreeNode<TContext>> {
    for (const child of this.children) {
      yield* walkDepthFirst(child, undefined);
    }
  }

  * walkFromNode(
    rootNode: Actor<TContext>
  ): IterableIterator<ActorTreeNode<TContext>> {
    for (const child of rootNode.children) {
      yield* walkDepthFirst(child, rootNode);
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
  node: Actor<TContext>,
  parentNode?: Actor<TContext>
): IterableIterator<ActorTreeNode<TContext>> {
  yield { actor: node, parent: parentNode };

  for (const child of node.children) {
    yield* walkDepthFirst(child, node);
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
