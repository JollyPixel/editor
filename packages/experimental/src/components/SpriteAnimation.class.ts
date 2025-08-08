// Import Third-party Dependencies
import * as THREE from "three";
// import { type Component } from "@jolly-pixel/engine";

export interface SpriteAnimationRange {
  from: number;
  to: number;
}

export interface SpriteAnimationOptions {
  [key: string]: (number[] | SpriteAnimationRange);
}

export interface SpriteRunningAnimation {
  name: string;
  frames: number[];
  frameIndex: number;
  loop: boolean;
  maxDuration: number;
  clock: THREE.Clock;
}

export interface SpriteAnimationPlayOptions {
  loop?: boolean;
  duration: number;
}

export class SpriteAnimation {
  #isPlaying = false;

  animations = new Map<string, number[]>();
  animation: SpriteRunningAnimation | null = null;

  constructor(
    animations: SpriteAnimationOptions
  ) {
    for (const [name, value] of Object.entries(animations)) {
      if (Array.isArray(value)) {
        this.animations.set(name, value);
      }
      else {
        this.animations.set(name, Array.from(range(value.from, value.to)));
      }
    }
  }

  get isPlaying() {
    return this.#isPlaying;
  }

  play(
    animationName: string,
    options: SpriteAnimationPlayOptions
  ) {
    const { loop = false, duration } = options;

    const animation = this.animations.get(animationName);
    if (!animation) {
      console.warn(`Animation "${animationName}" not found.`);

      return;
    }

    this.animation = {
      name: animationName,
      frames: animation.slice(0),
      frameIndex: 0,
      loop,
      maxDuration: duration / animation.length,
      clock: new THREE.Clock(true)
    };
    this.#isPlaying = true;
  }

  pause() {
    if (!this.animation) {
      return;
    }

    this.#isPlaying = false;
    this.animation.clock.stop();
  }

  resume() {
    if (!this.animation) {
      return;
    }

    this.#isPlaying = true;
    this.animation.clock.start();
  }

  stop() {
    this.animation = null;
    this.#isPlaying = false;
  }

  update(): null | number {
    if (!this.isPlaying || !this.animation) {
      return null;
    }

    const elapsedTime = this.animation.clock.getElapsedTime();
    if (
      this.animation.maxDuration > 0 &&
      elapsedTime >= this.animation.maxDuration
    ) {
      this.animation.clock = new THREE.Clock(true);
      this.animation.frameIndex = (this.animation.frameIndex + 1) % this.animation.frames.length;
      const frameId = this.animation.frames[this.animation.frameIndex];

      if (!this.animation.loop) {
        this.animation = null;
      }

      return frameId;
    }

    return null;
  }
}

function* range(
  from: number,
  to: number
): IterableIterator<number> {
  for (let i = from; i <= to; i++) {
    yield i;
  }
}
