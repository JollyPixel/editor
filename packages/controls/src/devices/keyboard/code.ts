// Import Internal Dependencies
import {
  isAlphabet,
  ALPHABET_TO_KEY,
  type Alphabet
} from "./transformers/alphabet.ts";
import {
  isNumeric,
  NUMERIC_TO_KEY,
  type Numeric
} from "./transformers/numeric.ts";

/**
 * @see https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_code_values
 */
export type KeyCode =
  | "Digit0" | "Digit1" | "Digit2" | "Digit3" | "Digit4" | "Digit5" | "Digit6" | "Digit7" | "Digit8" | "Digit9"
  | "Minus" | "Equal" | "Backspace" | "Tab" | "Comma" | "Period" | "Slash" | "Space" | "CapsLock"
  | "KeyA" | "KeyS" | "KeyD" | "KeyF" | "KeyG" | "KeyH" | "KeyJ" | "KeyK" | "KeyL"
  | "KeyQ" | "KeyW" | "KeyE" | "KeyR" | "KeyT" | "KeyY" | "KeyU" | "KeyI" | "KeyO" | "KeyP"
  | "KeyZ" | "KeyX" | "KeyC" | "KeyV" | "KeyB" | "KeyN" | "KeyM"
  | "BracketLeft" | "BracketRight" | "Enter"
  | "Semicolon" | "Quote" | "Backquote" | "Backslash" | "ContextMenu"
  | "Delete" | "Insert" | "Home" | "End" | "PageUp" | "PageDown"
  | "ArrowLeft" | "ArrowUp" | "ArrowRight" | "ArrowDown"
  | "ShiftRight" | "ShiftLeft" | "IntlBackslash"
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12"
  | "F13" | "F14" | "F15" | "F16" | "F17" | "F18" | "F19" | "F20" | "F21" | "F22" | "F23" | "F24"
  | "NumLock" | "ScrollLock"
  | "NumpadEnter" | "NumpadDivide" | "NumpadMultiply"
  | "Numpad7" | "Numpad8" | "Numpad9" | "NumpadSubtract"
  | "Numpad4" | "Numpad5" | "Numpad6" | "NumpadAdd"
  | "Numpad1" | "Numpad2" | "Numpad3" | "Numpad0" | "NumpadDecimal"
  | "IntlRo" | "KanaMode" | "Lang1" | "Lang2"
  | "ControlRight" | "ControlLeft" | "AltRight" | "AltLeft" | "MetaLeft" | "MetaRight"
  | "Fn" | "FnLock"
  | "AudioVolumeMute" | "AudioVolumeUp" | "AudioVolumeDown"
  | "PrintScreen" | "Pause"
  | "BrowserBack" | "BrowserForward" | "BrowserFavorites" | "BrowserRefresh" | "BrowserStop" | "BrowserSearch" | "BrowserHome"
  | "LaunchApp2" | "LaunchApp1"
  | "MediaPlayPause" | "MediaStop" | "MediaTrackNext" | "MediaTrackPrevious"
  | "Power" | "Sleep" | "WakeUp";

export type ExtendedKeyCode = KeyCode | Alphabet | Numeric;

export function mapKeyToExtendedKey(
  key: ExtendedKeyCode
): KeyCode {
  if (isAlphabet(key)) {
    return ALPHABET_TO_KEY[key.toUpperCase()];
  }

  if (isNumeric(key)) {
    return NUMERIC_TO_KEY[key];
  }

  return key;
}
