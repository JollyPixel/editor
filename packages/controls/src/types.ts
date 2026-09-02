// Import Internal Dependencies
import type {
  ExtendedKeyCode,
  KeyCode
} from "./devices/index.ts";

export interface Vector2Like {
  x: number;
  y: number;
}

export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export interface InputUpdateable {
  reset(): void;
  update(): void;

  readonly wasActive: boolean;
}

export interface InputConnectable {
  connect?(): void;
  disconnect?(): void;
}

export interface InputControl extends InputUpdateable, InputConnectable {}

export type InputCustomAction = "ANY" | "NONE";

export type {
  ExtendedKeyCode,
  KeyCode
};
