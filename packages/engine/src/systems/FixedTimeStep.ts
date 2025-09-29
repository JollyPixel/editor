// Import Third-party Dependencies
import * as THREE from "three";

export interface TimerAdapter {
  update: () => void;
  getDelta: () => number;
}

export class FixedTimeStep {
  framesPerSecond = 60;
  clock: TimerAdapter;

  constructor(
    clock: TimerAdapter = new THREE.Timer()
  ) {
    this.clock = clock;
  }

  tick(
    accumulatedTime: number,
    callback?: (deltaTime: number) => boolean
  ): { updates: number; timeLeft: number; } {
    this.clock.update();

    const updateInterval = 1000 / this.framesPerSecond;
    let newAccumulatedTime = accumulatedTime;

    // Limit how many update()s to try and catch up,
    // to avoid falling into the "black pit of despair" aka "doom spiral".
    // where every tick takes longer than the previous one.
    // See http://blogs.msdn.com/b/shawnhar/archive/2011/03/25/technical-term-that-should-exist-quot-black-pit-of-despair-quot.aspx
    const maxAccumulatedUpdates = 5;
    const maxAccumulatedTime = maxAccumulatedUpdates * updateInterval;
    if (newAccumulatedTime > maxAccumulatedTime) {
      newAccumulatedTime = maxAccumulatedTime;
    }

    // Update
    let updates = 0;
    while (newAccumulatedTime >= updateInterval) {
      if (callback?.(this.clock.getDelta())) {
        break;
      }
      newAccumulatedTime -= updateInterval;
      updates++;
    }

    return { updates, timeLeft: newAccumulatedTime };
  }
}
