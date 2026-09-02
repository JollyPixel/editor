// Import Node.js Dependencies
import { mock } from "node:test";

// Import Internal Dependencies
import type {
  NavigatorAdapter as NavigatorAdapterContract
} from "../../src/adapters/navigator.ts";

export interface GamepadButtonMock {
  pressed: boolean;
  touched?: boolean;
  value: number;
}

export interface GamepadMock {
  id: string;
  index: number;
  connected: boolean;
  timestamp: number;
  mapping: GamepadMappingType;
  buttons: Array<GamepadButtonMock | null>;
  axes: Array<number | null>;
  vibrationActuator: ReturnType<typeof GamepadHapticActuator> | null;
}

export function GamepadHapticActuator() {
  return {
    playEffect: mock.fn<globalThis.GamepadHapticActuator["playEffect"]>(
      () => Promise.resolve("complete")
    ),
    reset: mock.fn<globalThis.GamepadHapticActuator["reset"]>(
      () => Promise.resolve("complete")
    )
  } satisfies globalThis.GamepadHapticActuator;
}

export function Gamepad(): GamepadMock {
  return {
    id: "mock-gamepad",
    index: 0,
    connected: true,
    timestamp: Date.now(),
    mapping: "standard",
    buttons: Array.from({ length: 16 }, () => {
      return { pressed: false, value: 0 };
    }),
    axes: Array.from({ length: 4 }, () => 0),
    vibrationActuator: null
  };
}

export class NavigatorAdapter implements NavigatorAdapterContract {
  gamepads: Array<GamepadMock | null> = [null, null, null, null];

  getGamepads(): (globalThis.Gamepad | null)[] {
    return this.toNativeGamepads();
  }

  toNativeGamepads(): (globalThis.Gamepad | null)[] {
    return this.gamepads as unknown as (globalThis.Gamepad | null)[];
  }

  vibrate(_pattern: VibratePattern) {
    return true;
  }
}
