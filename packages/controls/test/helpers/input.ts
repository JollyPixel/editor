// Import Internal Dependencies
import {
  Input,
  type KeyCode
} from "../../src/index.ts";
import * as mocks from "../mocks/index.ts";
import { MouseCanvasAdapter } from "../devices/mouse/Mouse.fixture.ts";
import { KeyboardDocumentAdapter } from "../devices/keyboard/Keyboard.fixture.ts";

export interface InputFixture {
  input: Input;
  canvas: MouseCanvasAdapter;
  documentAdapter: KeyboardDocumentAdapter;
  windowAdapter: mocks.WindowAdapter;
  press(code: KeyCode): void;
  release(code: KeyCode): void;
  plug(index?: number): mocks.GamepadMock;
}

export function createInputFixture(): InputFixture {
  const canvas = new MouseCanvasAdapter();
  const documentAdapter = new KeyboardDocumentAdapter();
  const windowAdapter = new mocks.WindowAdapter();
  const input = new Input(canvas, {
    documentAdapter,
    windowAdapter
  });
  input.connect();

  return {
    input,
    canvas,
    documentAdapter,
    windowAdapter,
    press(code) {
      documentAdapter.dispatchEvent("keydown", { code });
    },
    release(code) {
      documentAdapter.dispatchEvent("keyup", { code });
    },
    plug(index = 0) {
      const pad = mocks.Gamepad();
      windowAdapter.navigator.gamepads[index] = pad;

      return pad;
    }
  };
}
