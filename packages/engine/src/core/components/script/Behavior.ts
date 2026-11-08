// Import Internal Dependencies
import type {
  WorldDefaultContext
} from "../../systems/World.ts";
import {
  type Actor,
  ActorComponent
} from "../../actor/index.ts";
import { BehaviorInitializer } from "./BehaviorInitializer.ts";

export interface BehaviorOptions {
  /**
   * Field values assigned once field initializers have run, before the
   * `@SceneProperty` defaults resolve.
   */
  properties?: Readonly<Record<string, unknown>>;
}

export class Behavior<
  TContext = WorldDefaultContext
> extends ActorComponent<TContext> {
  #initialProperties: Readonly<Record<string, unknown>> | null;

  constructor(
    actor: Actor<TContext>,
    options: BehaviorOptions = {}
  ) {
    super({
      actor,
      typeName: "ScriptBehavior"
    });
    this.#initialProperties = options.properties ?? null;
  }

  bind(): void {
    if (this.#initialProperties !== null) {
      Object.assign(this, this.#initialProperties);
      this.#initialProperties = null;
    }
    BehaviorInitializer.for(this)?.load();
  }
}
