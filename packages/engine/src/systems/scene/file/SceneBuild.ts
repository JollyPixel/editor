// Import Internal Dependencies
import type { Actor } from "../../../actor/Actor.ts";
import type { Component } from "../../../components/types.ts";
import type { WorldDefaultContext } from "../../World.ts";

export class SceneBuild<
  TContext = WorldDefaultContext
> {
  #actors: ReadonlyMap<string, Actor<TContext>>;
  #components: ReadonlyMap<string, Component>;

  constructor(
    actors: ReadonlyMap<string, Actor<TContext>>,
    components: ReadonlyMap<string, Component>
  ) {
    this.#actors = actors;
    this.#components = components;
  }

  actor(
    id: string
  ): Actor<TContext> | null {
    return this.#actors.get(id) ?? null;
  }

  component(
    id: string
  ): Component | null {
    return this.#components.get(id) ?? null;
  }
}
