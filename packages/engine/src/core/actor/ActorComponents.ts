// Import Internal Dependencies
import type { Component } from "../components/types.ts";

export type ComponentClass<T extends Component = Component> = abstract new (
  ...args: any[]
) => T;

export class ActorComponents implements Iterable<Component> {
  #all: Component[] = [];
  #updating: readonly Component[] = [];

  get updating(): boolean {
    return this.#updating.length > 0;
  }

  has(
    component: Component
  ): boolean {
    return this.#all.includes(component);
  }

  attach(
    component: Component
  ): void {
    this.#all.push(component);
  }

  detach(
    component: Component
  ): void {
    const index = this.#all.indexOf(component);
    if (index !== -1) {
      this.#all.splice(index, 1);
    }
  }

  requireUpdate(
    component: Component,
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

  find<T extends Component>(
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

  * matching<T extends Component>(
    type: ComponentClass<T>
  ): IterableIterator<T> {
    for (const component of this) {
      if (component instanceof type) {
        yield component;
      }
    }
  }

  * [Symbol.iterator](): IterableIterator<Component> {
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
