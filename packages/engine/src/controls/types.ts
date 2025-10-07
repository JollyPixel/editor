// Import Internal Dependencies
import type {
  ExtendedKeyCode,
  KeyCode
} from "./keyboard/code.js";
import type { MouseEventButton } from "./targets/Mouse.class.js";

/**
 * Interface for input controls that maintain state and need periodic updates using eg. requestAnimationFrame.
 */
export interface InputUpdateable {
  reset(): void;
  update(): void;
}

/**
 * Interface for input controls that need to register/unregister DOM event listeners.
 */
export interface InputConnectable {
  connect?(): void;
  disconnect?(): void;
}

export interface InputControl extends InputUpdateable, InputConnectable {}

export type InputCustomAction = "ANY" | "NONE";
export type InputKeyboardAction = ExtendedKeyCode | InputCustomAction;
export type InputMouseAction =
  | number
  | keyof typeof MouseEventButton
  | InputCustomAction;

export type {
  ExtendedKeyCode,
  KeyCode
};
