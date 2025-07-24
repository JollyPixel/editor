// Import Internal Dependencies
import { Actor } from "./Actor.js";

export type ActorTreeNode = {
  actor: Actor;
  parent?: Actor;
};

export class ActorTree {
  root: Actor[] = [];

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
