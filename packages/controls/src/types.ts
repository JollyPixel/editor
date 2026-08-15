// Import Internal Dependencies
import type {
  ExtendedKeyCode,
  KeyCode
} from "./devices/index.ts";

export interface Vector2Like {
  x: number;
  y: number;
}

/**
 * Interface for input controls that maintain state and need periodic updates using eg. requestAnimationFrame.
 */
export interface InputUpdateable {
  reset(): void;
  update(): void;

  readonly wasActive: boolean;
}

/**
 * Interface for input controls that need to register/unregister DOM event listeners.
 */
export interface InputConnectable {
  connect?(): void;
  disconnect?(): void;
}

export interface InputControl extends InputUpdateable, InputConnectable {}

/**
 * Sentinel actions accepted by `Mouse#isDown`/`Keyboard#isDown` and their
 * `wasJust*` counterparts, dispatched through `InputActionQuery`.
 */
export type InputCustomAction = "ANY" | "NONE";

export type {
  ExtendedKeyCode,
  KeyCode
};
