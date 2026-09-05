// Import Internal Dependencies
import { Gamepad } from "../../../src/index.ts";
import * as mocks from "../../mocks/index.ts";

export interface GamepadFixture {
  gamepad: Gamepad;
  navigatorAdapter: mocks.NavigatorAdapter;
}

export function createGamepadFixture(): GamepadFixture {
  const navigatorAdapter = new mocks.NavigatorAdapter();
  const gamepad = new Gamepad({
    navigatorAdapter
  });

  return {
    gamepad,
    navigatorAdapter
  };
}
