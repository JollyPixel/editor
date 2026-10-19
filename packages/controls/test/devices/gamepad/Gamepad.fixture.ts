// Import Internal Dependencies
import { Gamepad } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";

export interface GamepadFixture {
  gamepad: Gamepad;
  navigatorAdapter: mocks.NavigatorAdapter;
  plug(index?: number): mocks.GamepadMock;
}

export function createGamepadFixture(): GamepadFixture {
  const navigatorAdapter = new mocks.NavigatorAdapter();
  const gamepad = new Gamepad({
    navigatorAdapter
  });

  return {
    gamepad,
    navigatorAdapter,
    plug(index = 0) {
      const pad = mocks.Gamepad();
      navigatorAdapter.gamepads[index] = pad;

      return pad;
    }
  };
}
