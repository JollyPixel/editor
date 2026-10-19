// Import Internal Dependencies
import type { Accumulator } from "./ReaderBuffer.ts";

export class ControlEdges<TControl> implements Accumulator<
  ControlEdges<TControl>
> {
  readonly pressed = new Set<TControl>();
  readonly released = new Set<TControl>();
  readonly repeated = new Set<TControl>();
  readonly startedDown = new Set<TControl>();

  get empty(): boolean {
    return this.pressed.size === 0 &&
      this.released.size === 0 &&
      this.repeated.size === 0;
  }

  touched(
    control: TControl
  ): boolean {
    return this.pressed.has(control) || this.released.has(control);
  }

  press(
    control: TControl
  ): void {
    this.pressed.add(control);
  }

  release(
    control: TControl
  ): void {
    if (!this.touched(control)) {
      this.startedDown.add(control);
    }
    this.released.add(control);
  }

  addTo(
    target: ControlEdges<TControl>
  ): void {
    for (const control of this.startedDown) {
      if (!target.touched(control)) {
        target.startedDown.add(control);
      }
    }
    for (const control of this.pressed) {
      target.pressed.add(control);
    }
    for (const control of this.released) {
      target.released.add(control);
    }
    for (const control of this.repeated) {
      target.repeated.add(control);
    }
  }

  clear(): void {
    this.pressed.clear();
    this.released.clear();
    this.repeated.clear();
    this.startedDown.clear();
  }
}
