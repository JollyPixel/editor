// Import Internal Dependencies
import {
  GameInstance
} from "../systems/GameInstance.ts";

export interface GlobalsAdapter {
  setGame(instance: GameInstance<any, any>): void;
}

export class BrowserGlobalsAdapter implements GlobalsAdapter {
  setGame(
    instance: GameInstance<any, any>
  ) {
    globalThis.game = instance;
  }
}
