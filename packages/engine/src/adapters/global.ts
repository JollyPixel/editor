// Import Internal Dependencies
import {
  GameInstance
} from "../systems/GameInstance.ts";

export interface GlobalsAdapter {
  setGame(instance: GameInstance<any>): void;
}

export class BrowserGlobalsAdapter implements GlobalsAdapter {
  setGame(
    instance: GameInstance<any>
  ) {
    globalThis.game = instance;
  }
}
