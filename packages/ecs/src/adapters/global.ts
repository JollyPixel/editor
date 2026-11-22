// Import Internal Dependencies
import {
  World
} from "../systems/World.ts";

export interface GlobalsAdapter {
  exposeGame(instance: World<any, any>): void;
}

export class BrowserGlobalsAdapter implements GlobalsAdapter {
  exposeGame(
    instance: World<any, any>
  ) {
    globalThis.game = instance;
  }
}
