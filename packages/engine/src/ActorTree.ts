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

export class ActorTree extends EventTarget {
  #addCallback?: (actor: Actor) => void;
  #removeCallback?: (actor: Actor) => void;

  root: Actor[] = [];
  actorsToBeDestroyed: Actor[] = [];

  constructor(options: ActorTreeOptions = {}) {
    super();
    this.#addCallback = options.addCallback;
    this.#removeCallback = options.removeCallback;
  }

  add(
    actor: Actor
  ): void {
    this.root.push(actor);
    this.#addCallback?.(actor);
  }

  remove(actor: Actor): void {
    const index = this.root.indexOf(actor);
    if (index !== -1) {
      this.root.splice(index, 1);
      this.#removeCallback?.(actor);
    }
  }

  getActor(
    name: string
  ): Actor | null {
    for (const { actor } of this.walk()) {
      if (actor.name === name && !actor.pendingForDestruction) {
        return actor;
      }
    }

    return null;
  }

  * getRootActors(): IterableIterator<Actor> {
    for (const rootActor of this.root) {
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
      this.actorsToBeDestroyed.push(actor);
      actor.markDestructionPending();
    }
  }

  destroyAllActors() {
    for (const { actor } of this.walk()) {
      this.destroyActor(actor);
    }

    this.dispatchEvent(new CustomEvent("SkipRendering"));
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
    for (const child of this.root) {
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
}
