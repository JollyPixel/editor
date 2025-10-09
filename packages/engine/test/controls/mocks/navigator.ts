export function Gamepad(): any {
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
    hapticActuators: []
  };
}

export class NavigatorAdapter {
  gamepads = [null, null, null, null];

  getGamepads(): (globalThis.Gamepad | null)[] {
    return this.gamepads;
  }

  vibrate(_pattern: VibratePattern) {
    return true;
  }
}
