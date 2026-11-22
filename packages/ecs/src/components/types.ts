// Import Internal Dependencies
import type { ActorComponent } from "../actor/ActorComponent.ts";

export type ComponentClass<
  T extends ActorComponent<any> = ActorComponent<any>
> = abstract new (
  ...args: any[]
) => T;
