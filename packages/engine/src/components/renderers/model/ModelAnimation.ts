// Import Third-party Dependencies
import * as THREE from "three";

export type ModelAnimationClipNameRewriter = (clipName: string) => string;
export type ModelAnimationState = "idle" | "playing" | "paused" | "stopped";

export interface ModelAnimationPlayOptions {
  fadeInDuration?: number;
  fadeOutDuration?: number;
  loop?: boolean;
}

export interface ModelAnimationStopOptions {
  fadeOutDuration?: number;
}

interface FadingAction {
  action: THREE.AnimationAction;
  elapsed: number;
  duration: number;
}

interface ScheduledTransition<
  TClipName extends string
> {
  action: THREE.AnimationAction;
  name: TClipName;
  fadeInDuration: number;
  fadeOutDuration: number;
  loop: boolean;
}

export class ModelAnimation<
  TClipName extends string = string
> {
  #mixer: THREE.AnimationMixer;
  #clipNameRewriter: ModelAnimationClipNameRewriter = (name) => name;
  #clips = new Map<string, THREE.AnimationAction>();

  #defaultFadeDuration = 1;
  #state: ModelAnimationState = "idle";

  #current: THREE.AnimationAction | null = null;
  #currentName: TClipName | null = null;
  #currentFadeOutDuration = 0;

  #fadingOut: FadingAction[] = [];
  #pending: { name: TClipName; options: ModelAnimationPlayOptions; } | null = null;
  #next: ScheduledTransition<TClipName> | null = null;

  onFinished: ((clipName: TClipName) => void) | null = null;

  get state(): ModelAnimationState {
    return this.#state;
  }

  get isPlaying(): boolean {
    return this.#state === "playing";
  }

  get isPaused(): boolean {
    return this.#state === "paused";
  }

  get currentName(): TClipName | null {
    return this.#currentName;
  }

  setMixer(
    mixer: THREE.AnimationMixer
  ) {
    this.#mixer = mixer;
    this.#mixer.addEventListener("finished", (event) => {
      if (event.action === this.#current) {
        const finishedName = this.#currentName;
        this.#state = "stopped";
        this.#current = null;
        this.#currentName = null;
        if (finishedName !== null) {
          this.onFinished?.(finishedName);
        }
      }
    });

    return this;
  }

  setClipNameRewriter(
    rewriter: ModelAnimationClipNameRewriter
  ) {
    this.#clipNameRewriter = rewriter;
    if (this.#clips.size > 0) {
      const renamedClips = new Map<string, THREE.AnimationAction>();
      for (const [name, action] of this.#clips) {
        renamedClips.set(this.#clipNameRewriter(name), action);
      }
      this.#clips = renamedClips;
    }

    return this;
  }

  setClips(
    clips: THREE.AnimationClip[]
  ) {
    for (const clip of clips) {
      const action = this.#mixer.clipAction(clip);
      this.#clips.set(this.#clipNameRewriter(clip.name), action);
    }

    return this;
  }

  setFadeDuration(
    duration: number
  ) {
    this.#defaultFadeDuration = duration;

    return this;
  }

  play(
    name: TClipName,
    options: ModelAnimationPlayOptions = {}
  ) {
    if (!this.#mixer) {
      this.#pending = { name, options };

      return;
    }

    const {
      fadeInDuration = this.#defaultFadeDuration,
      fadeOutDuration = fadeInDuration,
      loop = true
    } = options;

    const action = this.#clips.get(name);
    if (!action) {
      throw new Error(`Animation clip "${name}" not found!`);
    }

    if (action === this.#current) {
      return;
    }

    this.#next = { action, name, fadeInDuration, fadeOutDuration, loop };
  }

  stop(
    options: ModelAnimationStopOptions = {}
  ) {
    if (!this.#current) {
      return;
    }

    const { fadeOutDuration = 0 } = options;
    if (fadeOutDuration > 0) {
      this.#current.fadeOut(fadeOutDuration);
      this.#fadingOut.push({ action: this.#current, elapsed: 0, duration: fadeOutDuration });
    }
    else {
      this.#current.stop();
    }

    this.#current = null;
    this.#currentName = null;
    this.#state = "stopped";
  }

  pause() {
    if (this.#state !== "playing") {
      return;
    }

    this.#mixer.timeScale = 0;
    this.#state = "paused";
  }

  resume() {
    if (this.#state !== "paused") {
      return;
    }

    this.#mixer.timeScale = 1;
    this.#state = "playing";
  }

  start() {
    if (this.#pending) {
      this.play(this.#pending.name, this.#pending.options);
      this.#pending = null;
    }
  }

  update(
    deltaTime: number
  ) {
    if (!this.#mixer) {
      return;
    }

    for (let i = this.#fadingOut.length - 1; i >= 0; i--) {
      const fading = this.#fadingOut[i];
      fading.elapsed += deltaTime;
      if (fading.elapsed >= fading.duration) {
        fading.action.stop();
        this.#fadingOut.splice(i, 1);
      }
    }

    if (this.#next) {
      const { action, name, fadeInDuration, fadeOutDuration, loop } = this.#next;
      this.#next = null;

      const fadingIdx = this.#fadingOut.findIndex((f) => f.action === action);
      if (fadingIdx !== -1) {
        this.#fadingOut.splice(fadingIdx, 1);
      }

      if (this.#current) {
        this.#current.fadeOut(this.#currentFadeOutDuration);
        this.#fadingOut.push({ action: this.#current, elapsed: 0, duration: this.#currentFadeOutDuration });
      }

      if (this.#mixer.timeScale === 0) {
        this.#mixer.timeScale = 1;
      }

      action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
      action.clampWhenFinished = !loop;
      action.reset().fadeIn(fadeInDuration).play();

      this.#current = action;
      this.#currentName = name;
      this.#currentFadeOutDuration = fadeOutDuration;
      this.#state = "playing";
    }

    this.#mixer.update(deltaTime);
  }
}
