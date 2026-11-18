export interface NavigatorAdapter {
  pollGamepads(): (Gamepad | null)[];
  vibrate(
    pattern: VibratePattern,
  ): boolean;
}

export class BrowserNavigatorAdapter implements NavigatorAdapter {
  pollGamepads(): (Gamepad | null)[] {
    return navigator.getGamepads();
  }

  vibrate(
    pattern: VibratePattern
  ): boolean {
    return navigator.vibrate(pattern);
  }
}
