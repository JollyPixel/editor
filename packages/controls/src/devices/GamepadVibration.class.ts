export interface GamepadVibrationOptions {
  /**
   * @default 0
   */
  startDelay?: number;
  /**
   * @default intensity
   */
  strongMagnitude?: number;
  /**
   * @default intensity
   */
  weakMagnitude?: number;
  /**
   * @default "dual-rumble"
   */
  effectType?: GamepadHapticEffectType;
}

/**
 * Wraps the haptic actuator of a single connected gamepad (if any).
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/API/GamepadHapticActuator
 */
export class GamepadVibration {
  #actuator: GamepadHapticActuator | null;

  constructor(
    actuator: GamepadHapticActuator | null = null
  ) {
    this.#actuator = actuator;
  }

  get canVibrate(): boolean {
    return this.#actuator !== null;
  }

  /**
   * @internal Refreshed by `Gamepad#update()` from the latest actuator snapshot.
   */
  setActuator(
    actuator: GamepadHapticActuator | null
  ): void {
    this.#actuator = actuator;
  }

  async pulse(
    intensity: number,
    duration: number,
    options: GamepadVibrationOptions = {}
  ): Promise<boolean> {
    if (this.#actuator === null) {
      return false;
    }
    const {
      startDelay = 0,
      strongMagnitude = intensity,
      weakMagnitude = intensity,
      effectType = "dual-rumble"
    } = options;

    const result = await this.#actuator.playEffect(effectType, {
      duration,
      startDelay,
      strongMagnitude,
      weakMagnitude
    });

    return result === "complete";
  }

  async stop(): Promise<boolean> {
    if (this.#actuator === null) {
      return false;
    }

    const result = await this.#actuator.reset();

    return result === "complete";
  }
}
