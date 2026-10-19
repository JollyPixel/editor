// Import Internal Dependencies
import type {
  InputCustomAction,
  InputReader
} from "../types.ts";
import { ControlEdges } from "./ControlEdges.ts";
import { ReaderBuffer } from "./ReaderBuffer.ts";

export type ControlQuery<TControl> = TControl | InputCustomAction;

export class ControlBank<TControl> {
  #held = new Set<TControl>();
  #edges = new ReaderBuffer(() => new ControlEdges<TControl>());
  #active = false;

  get active(): boolean {
    return this.#active;
  }

  press(
    control: TControl
  ): boolean {
    if (this.#held.has(control)) {
      return false;
    }

    this.#held.add(control);
    this.#edges.queued.press(control);

    return true;
  }

  release(
    control: TControl
  ): void {
    if (this.#held.delete(control)) {
      this.#edges.queued.release(control);
    }
  }

  follow(
    control: TControl,
    down: boolean
  ): boolean {
    if (down) {
      return this.press(control);
    }

    this.release(control);

    return false;
  }

  repeat(
    control: TControl
  ): void {
    this.#edges.queued.repeated.add(control);
  }

  releaseAll(): void {
    for (const control of this.#held) {
      this.#edges.queued.release(control);
    }
    this.#held.clear();
  }

  sample(): void {
    this.#active = this.#held.size > 0 || !this.#edges.queued.empty;
    this.#edges.sample();
  }

  publish(
    reader: InputReader
  ): void {
    this.#edges.publish(reader);
  }

  isDown(
    query: ControlQuery<TControl>
  ): boolean {
    return ControlBank.#matches(this.#held, query);
  }

  wasDownBefore(
    control: TControl
  ): boolean {
    const edges = this.#edges.published;
    if (edges.touched(control)) {
      return edges.startedDown.has(control);
    }

    return this.#held.has(control);
  }

  wasPressed(
    query: ControlQuery<TControl>
  ): boolean {
    return ControlBank.#matches(this.#edges.published.pressed, query);
  }

  wasReleased(
    query: ControlQuery<TControl>
  ): boolean {
    return ControlBank.#matches(this.#edges.published.released, query);
  }

  wasRepeated(
    query: ControlQuery<TControl>
  ): boolean {
    return ControlBank.#matches(this.#edges.published.repeated, query);
  }

  reset(): void {
    this.#held.clear();
    this.#edges.reset();
    this.#active = false;
  }

  static #matches<TControl>(
    controls: ReadonlySet<TControl>,
    query: ControlQuery<TControl>
  ): boolean {
    switch (query) {
      case "ANY":
        return controls.size > 0;
      case "NONE":
        return controls.size === 0;
      default:
        return controls.has(query);
    }
  }
}
