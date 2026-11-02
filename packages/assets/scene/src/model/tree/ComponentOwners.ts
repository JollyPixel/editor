// Import Internal Dependencies
import type { SceneActorView } from "../../network/types.ts";

export class ComponentOwners {
  readonly #owners = new Map<string, string>();

  owner(
    componentId: string
  ): string | undefined {
    return this.#owners.get(componentId);
  }

  owns(
    actorId: string,
    componentId: string
  ): boolean {
    return this.#owners.get(componentId) === actorId;
  }

  has(
    componentId: string
  ): boolean {
    return this.#owners.has(componentId);
  }

  register(
    actor: SceneActorView
  ): void {
    for (const component of actor.components) {
      this.#owners.set(component.id, actor.id);
    }
  }

  forget(
    actor: SceneActorView
  ): void {
    for (const component of actor.components) {
      this.#owners.delete(component.id);
    }
  }

  add(
    componentId: string,
    actorId: string
  ): void {
    this.#owners.set(componentId, actorId);
  }

  delete(
    componentId: string
  ): void {
    this.#owners.delete(componentId);
  }

  clear(): void {
    this.#owners.clear();
  }
}
