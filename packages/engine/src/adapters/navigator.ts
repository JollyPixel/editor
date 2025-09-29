export interface NavigatorAdapter {
  getGamepads(): (Gamepad | null)[];
  vibrate(pattern: VibratePattern): boolean;
}

export class BrowserNavigatorAdapter implements NavigatorAdapter {
  getGamepads(): (Gamepad | null)[] {
    return navigator.getGamepads();
  }

  vibrate(
    pattern: VibratePattern
  ): boolean {
    return navigator.vibrate(pattern);
  }
}
