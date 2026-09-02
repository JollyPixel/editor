// Import Internal Dependencies
import type { Input } from "../Input.class.ts";
import type {
  Vector2Like,
  Vector3Like
} from "../types.ts";
import type { Axis } from "./Axis.ts";
import { UnknownAxisError } from "./errors/index.ts";

export type AxisDefinition<
  TName extends string
> = Record<TName, Axis>;

interface AxisState {
  axis: Axis;
  value: number;
}

export class AxisMap<
  TName extends string = string
> {
  enabled = true;

  #axes: Map<TName, AxisState>;
  #states: AxisState[];
  #zeroed = true;

  constructor(
    definition: AxisDefinition<TName>
  ) {
    this.#states = [];
    this.#axes = new Map();

    const entries = Object.entries<Axis>(definition) as [TName, Axis][];
    for (const [name, axis] of entries) {
      const state = {
        axis,
        value: 0
      };
      this.#states.push(state);
      this.#axes.set(name, state);
    }
  }

  get names(): Iterable<TName> {
    return this.#axes.keys();
  }

  update(
    input: Input
  ): void {
    const states = this.#states;

    if (!this.enabled) {
      if (this.#zeroed) {
        return;
      }
      for (const state of states) {
        state.value = 0;
      }
      this.#zeroed = true;

      return;
    }

    this.#zeroed = false;
    for (const state of states) {
      state.value = state.axis.sample(input);
    }
  }

  value(
    name: TName
  ): number {
    const state = this.#axes.get(name);
    if (state === undefined) {
      throw new UnknownAxisError(name);
    }

    return state.value;
  }

  vector2<T extends Vector2Like>(
    x: TName,
    y: TName,
    target: T
  ): T {
    target.x = this.value(x);
    target.y = this.value(y);

    return target;
  }

  vector3<T extends Vector3Like>(
    x: TName,
    y: TName,
    z: TName,
    target: T
  ): T {
    target.x = this.value(x);
    target.y = this.value(y);
    target.z = this.value(z);

    return target;
  }

  reset(): void {
    for (const state of this.#states) {
      state.axis.resetSources();
      state.value = 0;
    }
    this.#zeroed = true;
  }
}
