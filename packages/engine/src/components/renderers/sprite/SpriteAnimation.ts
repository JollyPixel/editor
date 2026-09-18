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
  frameDuration: number;
  elapsed: number;
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
      this.animations.set(
        name,
        Array.isArray(value) ? value : Array.from(range(value.from, value.to))
      );
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

    const frames = this.animations.get(animationName);
    if (!frames) {
      console.warn(`Animation "${animationName}" not found.`);

      return;
    }

    this.animation = {
      name: animationName,
      frames: frames.slice(0),
      frameIndex: 0,
      loop,
      frameDuration: duration / frames.length,
      elapsed: 0
    };
    this.#isPlaying = true;
  }

  pause() {
    if (this.animation) {
      this.#isPlaying = false;
    }
  }

  resume() {
    if (this.animation) {
      this.#isPlaying = true;
    }
  }

  stop() {
    this.animation = null;
    this.#isPlaying = false;
  }

  update(
    deltaTime: number
  ): number | null {
    const animation = this.animation;
    if (!this.#isPlaying || animation === null || animation.frameDuration <= 0) {
      return null;
    }

    animation.elapsed += deltaTime;
    const steps = Math.floor(animation.elapsed / animation.frameDuration);
    if (steps === 0) {
      return null;
    }
    animation.elapsed -= steps * animation.frameDuration;

    const lastIndex = animation.frames.length - 1;
    if (animation.loop) {
      animation.frameIndex = (animation.frameIndex + steps) % animation.frames.length;
    }
    else {
      animation.frameIndex = Math.min(animation.frameIndex + steps, lastIndex);
      if (animation.frameIndex === lastIndex) {
        this.#isPlaying = false;
      }
    }

    return animation.frames[animation.frameIndex];
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
