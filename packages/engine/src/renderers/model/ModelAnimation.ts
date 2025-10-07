// Import Third-party Dependencies
import * as THREE from "three";

export type ModelAnimationClipNameRewriter = (clipName: string) => string;

export interface ModelAnimationNext {
  action: THREE.AnimationAction;
  fadeDuration: number;
}

export interface ModelAnimationPlayOptions {
  fadeDuration?: number;
}

export class ModelAnimation {
  #mixer: THREE.AnimationMixer;
  #clipNameRewriter: ModelAnimationClipNameRewriter = (name) => name;
  #clips = new Map<string, THREE.AnimationAction>();

  #fadeDuration = 1;
  #last: THREE.AnimationAction | null = null;
  #current: THREE.AnimationAction | null = null;

  #nextAnimationName: string | void;
  #next: ModelAnimationNext | null = null;

  setMixer(
    mixer: THREE.AnimationMixer
  ) {
    this.#mixer = mixer;

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
    this.#fadeDuration = duration;

    return this;
  }

  play(
    animationName: string,
    options: ModelAnimationPlayOptions = {}
  ) {
    if (!this.#mixer) {
      this.#nextAnimationName = animationName;

      return;
    }

    const { fadeDuration = this.#fadeDuration } = options;

    const clip = this.#clips.get(animationName);
    if (!clip) {
      throw new Error(`Animation clip "${animationName}" not found!`);
    }

    if (clip !== this.#current) {
      this.#next = {
        action: clip,
        fadeDuration
      };
    }
  }

  stop() {
    if (this.#current) {
      this.#current.stop();
      this.#current = null;
    }
  }

  start() {
    if (this.#nextAnimationName) {
      this.play(this.#nextAnimationName);
      this.#nextAnimationName = undefined;
    }
  }

  update(
    deltaTime: number
  ) {
    if (!this.#mixer) {
      return;
    }

    if (this.#next && this.#next.action !== this.#current) {
      const fadeDuration = this.#next.fadeDuration;

      if (this.#current) {
        this.#last = this.#current;
        this.#last.fadeOut(fadeDuration);
      }
      this.#current = this.#next.action;
      this.#current.reset().fadeIn(fadeDuration).play();
    }

    this.#next = null;
    this.#mixer.update(deltaTime);
  }
}
