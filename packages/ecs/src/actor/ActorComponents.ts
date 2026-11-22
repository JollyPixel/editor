// Import Internal Dependencies
import type {
  ActorComponent,
  HookedComponent
} from "./ActorComponent.ts";
import type { ComponentClass } from "../components/types.ts";

export class ActorComponents implements Iterable<HookedComponent> {
  #all: HookedComponent[] = [];
  #updating: readonly HookedComponent[] = [];

  get updating(): boolean {
    return this.#updating.length > 0;
  }

  has(
    component: HookedComponent
  ): boolean {
    return this.#all.includes(component);
  }

  attach(
    component: HookedComponent
  ): void {
    this.#all.push(component);
  }

  detach(
    component: HookedComponent
  ): void {
    const index = this.#all.indexOf(component);
    if (index !== -1) {
      this.#all.splice(index, 1);
    }
  }

  requireUpdate(
    component: HookedComponent,
    required: boolean
  ): void {
    const index = this.#updating.indexOf(component);
    if (required === (index !== -1)) {
      return;
    }

    this.#updating = required ?
      [...this.#updating, component] :
      this.#updating.toSpliced(index, 1);
  }

  find<T extends ActorComponent<any>>(
    type: string | ComponentClass<T>
  ): T | null {
    for (const component of this) {
      const matches = typeof type === "string" ?
        component.typeName === type :
        component instanceof type;
      if (matches) {
        return component as T;
      }
    }

    return null;
  }

  * matching<T extends ActorComponent<any>>(
    type: ComponentClass<T>
  ): IterableIterator<T> {
    for (const component of this) {
      if (component instanceof type) {
        yield component;
      }
    }
  }

  * [Symbol.iterator](): IterableIterator<HookedComponent> {
    for (const component of this.#all) {
      if (!component.pendingForDestruction) {
        yield component;
      }
    }
  }

  awake(): void {
    for (let i = 0; i < this.#all.length; i++) {
      const component = this.#all[i];
      component.bind?.();
      component.awake?.();
    }
  }

  update(
    deltaTime: number,
    alpha: number
  ): void {
    for (const component of this.#updating) {
      component.update?.(deltaTime, alpha);
    }
  }

  fixedUpdate(
    deltaTime: number,
    stepIndex: number
  ): void {
    for (const component of this.#updating) {
      component.fixedUpdate?.(deltaTime, stepIndex);
    }
  }

  destroy(): void {
    for (const component of this.#all.toReversed()) {
      component.destroy();
    }
  }
}
