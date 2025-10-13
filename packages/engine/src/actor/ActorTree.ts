// Import Third-party Dependencies
import pm from "picomatch";

// Import Internal Dependencies
import { Actor } from "./Actor.js";

export type ActorTreeNode = {
  actor: Actor;
  parent?: Actor;
};

export interface ActorTreeOptions {
  addCallback?: (actor: Actor) => void;
  removeCallback?: (actor: Actor) => void;
}

export class ActorTree {
  #addCallback?: (actor: Actor) => void;
  #removeCallback?: (actor: Actor) => void;

  children: Actor[] = [];

  constructor(
    options: ActorTreeOptions = {}
  ) {
    this.#addCallback = options.addCallback;
    this.#removeCallback = options.removeCallback;
  }

  add(
    actor: Actor
  ): void {
    this.children.push(actor);
    this.#addCallback?.(actor);
  }

  remove(actor: Actor): void {
    const index = this.children.indexOf(actor);
    if (index !== -1) {
      this.children.splice(index, 1);
      this.#removeCallback?.(actor);
    }
  }

  * getActors(
    pattern: string
  ): IterableIterator<Actor> {
    if (pattern.includes("/")) {
      yield* this.#getActorsByPatternPath(pattern);

      return;
    }

    const isPatternMatching = pm(pattern);

    for (const { actor } of this.walk()) {
      if (isPatternMatching(actor.name) && !actor.pendingForDestruction) {
        yield actor;
      }
    }
  }

  * #getActorsByPatternPath(
    pattern: string
  ): IterableIterator<Actor> {
    const parts = pattern.split("/").filter((part) => part !== "");

    for (const rootActor of this.children) {
      if (!rootActor.pendingForDestruction) {
        yield* this.#matchActorPath(rootActor, parts, 0);
      }
    }
  }

  * #matchActorPath(
    actor: Actor,
    patternParts: string[],
    patternIndex: number
  ): IterableIterator<Actor> {
    if (patternIndex >= patternParts.length) {
      return;
    }

    const currentPattern = patternParts[patternIndex];
    const isLastPattern = patternIndex === patternParts.length - 1;

    // eslint-disable-next-line func-style
    const matchSinglePattern = (name: string, pattern: string) => pm(pattern)(name);

    if (currentPattern === "**") {
      if (isLastPattern) {
        for (const { actor: descendant } of this.#walkDepthFirstGenerator(actor)) {
          if (!descendant.pendingForDestruction) {
            yield descendant;
          }
        }

        return;
      }

      const nextPattern = patternParts[patternIndex + 1];
      for (const { actor: descendant } of this.#walkDepthFirstGenerator(actor)) {
        if (descendant.pendingForDestruction) {
          continue;
        }

        if (matchSinglePattern(descendant.name, nextPattern)) {
          if (patternIndex + 1 === patternParts.length - 1) {
            yield descendant;
          }
          else {
            yield* this.#matchActorPath(descendant, patternParts, patternIndex + 2);
          }
        }
      }

      return;
    }

    if (matchSinglePattern(actor.name, currentPattern)) {
      if (isLastPattern) {
        if (!actor.pendingForDestruction) {
          yield actor;
        }
      }
      else {
        for (const child of actor.children) {
          yield* this.#matchActorPath(child, patternParts, patternIndex + 1);
        }
      }
    }
  }

  /**
   * @example
   * const player = actor.children.getActor("player");
   * const playerPhysicsBox = actor.children.getActor("player/physics_box");
   */
  getActor(
    name: string
  ): Actor | null {
    if (name.includes("/")) {
      return this.#getActorByPath(name);
    }

    for (const { actor } of this.walk()) {
      if (actor.name === name && !actor.pendingForDestruction) {
        return actor;
      }
    }

    return null;
  }

  #getActorByPath(
    path: string
  ): Actor | null {
    const parts = path.split("/").filter((part) => part !== "");
    const parentNode = this.getActor(parts[0]);
    if (!parentNode) {
      return null;
    }

    let currentNode: Actor | null = parentNode;
    for (let i = 1; i < parts.length; i++) {
      if (!currentNode) {
        break;
      }

      currentNode = [...currentNode.children].find(
        (child) => child.name === parts[i]
      ) ?? null;
    }

    return currentNode;
  }

  * getRootActors(): IterableIterator<Actor> {
    for (const rootActor of this.children) {
      if (!rootActor.pendingForDestruction) {
        yield rootActor;
      }
    }
  }

  * getAllActors(): IterableIterator<Actor> {
    for (const { actor } of this.walk()) {
      yield actor;
    }
  }

  destroyActor(
    actor: Actor
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

  * #walkDepthFirstGenerator(
    node: Actor,
    parentNode?: Actor
  ): IterableIterator<ActorTreeNode> {
    yield { actor: node, parent: parentNode };

    for (const child of node.children) {
      yield* this.#walkDepthFirstGenerator(child, node);
    }
  }

  * walk(): IterableIterator<ActorTreeNode> {
    for (const child of this.children) {
      yield* this.#walkDepthFirstGenerator(child, undefined);
    }
  }

  * walkFromNode(
    rootNode: Actor
  ): IterableIterator<ActorTreeNode> {
    for (const child of rootNode.children) {
      yield* this.#walkDepthFirstGenerator(child, rootNode);
    }
  }

  * [Symbol.iterator](): IterableIterator<Actor> {
    for (const actor of this.children) {
      if (!actor.pendingForDestruction) {
        yield actor;
      }
    }
  }
}
