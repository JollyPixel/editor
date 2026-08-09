/**
 * Injectable subset of `Window` used for global input events.
 */
export interface WindowLike {
  addEventListener(
    type: "mousemove",
    listener: (event: MouseEvent) => void
  ): void;
  addEventListener(
    type: "mouseup",
    listener: (event: MouseEvent) => void
  ): void;
  addEventListener(
    type: "keydown",
    listener: (event: KeyboardEvent) => void
  ): void;
  addEventListener(
    type: "keyup",
    listener: (event: KeyboardEvent) => void
  ): void;
  addEventListener(
    type: "blur",
    listener: () => void
  ): void;
  removeEventListener(
    type: "mousemove",
    listener: (event: MouseEvent) => void
  ): void;
  removeEventListener(
    type: "mouseup",
    listener: (event: MouseEvent) => void
  ): void;
  removeEventListener(
    type: "keydown",
    listener: (event: KeyboardEvent) => void
  ): void;
  removeEventListener(
    type: "keyup",
    listener: (event: KeyboardEvent) => void
  ): void;
  removeEventListener(
    type: "blur",
    listener: () => void
  ): void;
}
