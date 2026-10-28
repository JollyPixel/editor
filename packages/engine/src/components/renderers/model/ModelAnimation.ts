// Import Third-party Dependencies
import * as THREE from "three/webgpu";

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

interface PlayingClip<
  TClipName extends string
> {
  action: THREE.AnimationAction;
  name: TClipName;
  fadeOutDuration: number;
}

interface ScheduledTransition<
  TClipName extends string
> extends PlayingClip<TClipName> {
  fadeInDuration: number;
  loop: boolean;
}

class FadingActions {
  #fading: FadingAction[] = [];

  get active(): boolean {
    return this.#fading.length > 0;
  }

  fadeOut(
    action: THREE.AnimationAction,
    duration: number
  ): void {
    action.fadeOut(duration);
    this.#fading.push({
      action,
      elapsed: 0,
      duration
    });
  }

  cancel(
    action: THREE.AnimationAction
  ): void {
    const index = this.#fading.findIndex((fading) => fading.action === action);
    if (index !== -1) {
      this.#fading.splice(index, 1);
    }
  }

  advance(
    deltaTime: number
  ): void {
    for (let i = this.#fading.length - 1; i >= 0; i--) {
      const fading = this.#fading[i];
      fading.elapsed += deltaTime;
      if (fading.elapsed >= fading.duration) {
        fading.action.stop();
        this.#fading.splice(i, 1);
      }
    }
  }
}

export class ModelAnimation<
  TClipName extends string = string
> {
  #mixer: THREE.AnimationMixer | null = null;
  #clipNameRewriter: ModelAnimationClipNameRewriter = (name) => name;
  #clips = new Map<string, THREE.AnimationAction>();

  #defaultFadeDuration = 1;
  #state: ModelAnimationState = "idle";

  #current: PlayingClip<TClipName> | null = null;
  #fading = new FadingActions();
  #pending: { name: TClipName; options: ModelAnimationPlayOptions; } | null = null;
  #next: ScheduledTransition<TClipName> | null = null;

  onFinished: ((clipName: TClipName) => void) | null = null;

  #requestUpdate: () => void;

  constructor(
    requestUpdate: () => void
  ) {
    this.#requestUpdate = requestUpdate;
  }

  get isAnimating(): boolean {
    return this.#state === "playing" ||
      this.#next !== null ||
      this.#fading.active;
  }

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
    return this.#current?.name ?? null;
  }

  setMixer(
    mixer: THREE.AnimationMixer
  ) {
    this.#mixer = mixer;
    mixer.addEventListener("finished", (event) => {
      const finished = this.#current;
      if (finished !== null && event.action === finished.action) {
        this.#state = "stopped";
        this.#current = null;
        this.onFinished?.(finished.name);
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
    const mixer = this.#requireMixer();
    for (const clip of clips) {
      this.#clips.set(this.#clipNameRewriter(clip.name), mixer.clipAction(clip));
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
    if (this.#mixer === null) {
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

    if (action === this.#current?.action) {
      return;
    }

    this.#next = { action, name, fadeInDuration, fadeOutDuration, loop };
    this.#requestUpdate();
  }

  stop(
    options: ModelAnimationStopOptions = {}
  ) {
    if (this.#current === null) {
      return;
    }

    const { fadeOutDuration = 0 } = options;
    if (fadeOutDuration > 0) {
      this.#fading.fadeOut(this.#current.action, fadeOutDuration);
      this.#requestUpdate();
    }
    else {
      this.#current.action.stop();
    }

    this.#current = null;
    this.#state = "stopped";
  }

  pause() {
    if (this.#state !== "playing") {
      return;
    }

    this.#requireMixer().timeScale = 0;
    this.#state = "paused";
  }

  resume() {
    if (this.#state !== "paused") {
      return;
    }

    this.#requireMixer().timeScale = 1;
    this.#state = "playing";
    this.#requestUpdate();
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
    const mixer = this.#mixer;
    if (mixer === null) {
      return;
    }

    this.#fading.advance(deltaTime);

    if (this.#next) {
      const { action, name, fadeInDuration, fadeOutDuration, loop } = this.#next;
      this.#next = null;

      this.#fading.cancel(action);
      if (this.#current) {
        this.#fading.fadeOut(
          this.#current.action,
          this.#current.fadeOutDuration
        );
      }

      if (mixer.timeScale === 0) {
        mixer.timeScale = 1;
      }

      action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
      action.clampWhenFinished = !loop;
      action.reset().fadeIn(fadeInDuration).play();

      this.#current = { action, name, fadeOutDuration };
      this.#state = "playing";
    }

    mixer.update(deltaTime);
  }

  #requireMixer(): THREE.AnimationMixer {
    if (this.#mixer === null) {
      throw new Error("ModelAnimation needs a mixer: call setMixer() first.");
    }

    return this.#mixer;
  }
}
