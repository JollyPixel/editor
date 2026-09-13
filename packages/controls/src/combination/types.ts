// Import Internal Dependencies
import type {
  MouseAction,
  ExtendedKeyCode
} from "../devices/index.ts";

export type CombinedInputState =
  | "down"
  | "pressed"
  | "released";

export type CombinedKeyboardInputAction = `${ExtendedKeyCode}.${CombinedInputState}`;
export type CombinedMouseInputAction = `${MouseAction}.${CombinedInputState}`;
export type CombinedInputAction = CombinedKeyboardInputAction | CombinedMouseInputAction;
