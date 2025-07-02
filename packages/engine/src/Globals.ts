// Import Internal Dependencies
import { GameInstance } from "./systems/GameInstance.js";
import { Actor } from "./Actor.js";

export const JollyPixel = {
  getActor(name: string): Actor | null {
    for (const { actor } of globalThis.game.tree.walk()) {
      if (actor.name === name && !actor.pendingForDestruction) {
        return actor;
      }
    }

    return null;
  },
  * getRootActors(): IterableIterator<Actor> {
    for (const rootActor of globalThis.game.tree.root) {
      if (!rootActor.pendingForDestruction) {
        yield rootActor;
      }
    }
  },
  * getAllActors(): IterableIterator<Actor> {
    for (const { actor } of globalThis.game.tree.walk()) {
      yield actor;
    }
  },
  destroyAllActors() {
    globalThis.game.destroyAllActors();
  }
} as const;
globalThis.JP = JollyPixel;

declare global {
  // eslint-disable-next-line
  var game: GameInstance;
  // eslint-disable-next-line
  var JP: typeof JollyPixel;
}
