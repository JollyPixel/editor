// Import Internal Dependencies
import type {
  ExtendedKeyCode,
  Gamepad,
  KeyCode,
  Keyboard,
  Mouse
} from "./devices/index.ts";

export interface InputDevices {
  readonly keyboard: Keyboard;
  readonly mouse: Mouse;
  readonly gamepad: Gamepad;
}

export interface Vector2Like {
  x: number;
  y: number;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export type InputReader = "step" | "frame";

export interface InputConnectable {
  connect(): void;
  disconnect(): void;
}

export interface InputControl extends InputConnectable {
  readonly wasActive: boolean;

  reset(): void;
  update(): void;
  sample(): void;
  publish(reader: InputReader): void;
}

export type InputCustomAction = "ANY" | "NONE";

export type {
  ExtendedKeyCode,
  KeyCode
};
