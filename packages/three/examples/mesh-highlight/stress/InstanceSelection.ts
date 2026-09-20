// Import Internal Dependencies
import type { InstanceGrid } from "./InstanceGrid.ts";

export class InstanceSelection {
  #grid: InstanceGrid;
  #selected: number[] = [];
  #hovered: number | null = null;

  constructor(
    grid: InstanceGrid
  ) {
    this.#grid = grid;
  }

  get selected(): readonly number[] {
    return this.#selected;
  }

  get hovered(): number | null {
    return this.#hovered === null || this.#selected.includes(this.#hovered) ?
      null :
      this.#hovered;
  }

  get anchorId(): number | null {
    return this.#selected.length === 1 ? this.#selected[0] : null;
  }

  clear(): void {
    this.#selected = [];
    this.#hovered = null;
  }

  select(
    instanceId: number | null
  ): void {
    this.#selected = instanceId === null ? [] : [instanceId];
  }

  selectMany(
    instanceIds: number[]
  ): void {
    this.#selected = instanceIds;
  }

  hover(
    instanceId: number | null
  ): boolean {
    if (instanceId === this.#hovered) {
      return false;
    }

    this.#hovered = instanceId;

    return true;
  }

  randomize(
    count: number
  ): void {
    this.#selected = this.#grid.randomIds(count);
  }

  truncate(
    max: number
  ): void {
    if (this.#selected.length > max) {
      this.#selected = this.#selected.slice(0, max);
    }
  }
}
