// Import Internal Dependencies
import type { Actor } from "./index.js";

export class ActorChildrenTree {
  root: Actor[] = [];

  * [Symbol.iterator]() {
    for (const actor of this.root) {
      if (!actor.isDestroyed()) {
        yield actor;
      }
    }
  }
}
