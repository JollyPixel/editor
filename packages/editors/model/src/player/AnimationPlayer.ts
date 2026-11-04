// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";
import * as THREE from "three/webgpu";

// CONSTANTS
export const PLAYBACK_SPEEDS = [0.25, 0.5, 1, 2] as const;

export type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number];

export interface AnimationClipEntry {
  readonly name: string;
  readonly duration: number;
}

type AnimationPlayerEvents = {
  change: () => void;
};

type PlaybackState = "stopped" | "playing" | "paused";

interface LoadedClips {
  root: THREE.Object3D;
  mixer: THREE.AnimationMixer;
  clips: Map<string, THREE.AnimationClip>;
  entries: readonly AnimationClipEntry[];
}

export class AnimationPlayer {
  #requestFrame: () => void;
  #events = new Emitter<AnimationPlayerEvents>();
  #loaded: LoadedClips | null = null;
  #action: THREE.AnimationAction | null = null;
  #state: PlaybackState = "stopped";
  #loop = true;
  #speed: PlaybackSpeed = 1;

  constructor(
    requestFrame: () => void
  ) {
    this.#requestFrame = requestFrame;
  }

  get clips(): readonly AnimationClipEntry[] {
    return this.#loaded?.entries ?? [];
  }

  get selected(): string | null {
    return this.#action?.getClip().name ?? null;
  }

  get playing(): boolean {
    return this.#state === "playing";
  }

  get time(): number {
    return this.#state === "stopped" ? 0 : this.#action?.time ?? 0;
  }

  get duration(): number {
    return this.#action?.getClip().duration ?? 0;
  }

  get loop(): boolean {
    return this.#loop;
  }

  set loop(
    value: boolean
  ) {
    this.#loop = value;
    if (this.#action !== null) {
      applyLoop(this.#action, value);
    }
    this.#changed();
  }

  get speed(): PlaybackSpeed {
    return this.#speed;
  }

  set speed(
    value: PlaybackSpeed
  ) {
    this.#speed = value;
    if (this.#loaded !== null) {
      this.#loaded.mixer.timeScale = value;
    }
    this.#changed();
  }

  subscribe(
    event: keyof AnimationPlayerEvents,
    listener: () => void
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  load(
    root: THREE.Object3D,
    clips: Iterable<THREE.AnimationClip>
  ): void {
    this.#release();

    const named = new Map<string, THREE.AnimationClip>();
    for (const clip of clips) {
      if (!named.has(clip.name)) {
        named.set(clip.name, clip);
      }
    }

    const mixer = new THREE.AnimationMixer(root);
    mixer.timeScale = this.#speed;
    mixer.addEventListener("finished", (event) => {
      if (event.action === this.#action) {
        this.#state = "stopped";
        this.#changed();
      }
    });
    this.#loaded = {
      root,
      mixer,
      clips: named,
      entries: [...named.values()].map((clip) => {
        return {
          name: clip.name,
          duration: clip.duration
        };
      })
    };

    const [first] = named.values();
    if (first !== undefined) {
      this.#aim(mixer, first);
    }
    this.#changed();
  }

  unload(): void {
    this.#release();
    this.#changed();
  }

  select(
    name: string
  ): void {
    const loaded = this.#loaded;
    const clip = loaded?.clips.get(name);
    if (loaded === null || clip === undefined || name === this.selected) {
      return;
    }

    const playing = this.playing;
    this.#action?.stop();
    this.#aim(loaded.mixer, clip);
    if (playing) {
      this.play();
    }
    else {
      this.#changed();
    }
  }

  play(): void {
    const action = this.#action;
    if (action === null || this.#state === "playing") {
      return;
    }

    if (this.#state === "paused") {
      action.paused = false;
    }
    else {
      action.reset().play();
    }
    this.#state = "playing";
    this.#changed();
  }

  pause(): void {
    if (this.#action === null || this.#state !== "playing") {
      return;
    }

    this.#action.paused = true;
    this.#state = "paused";
    this.#changed();
  }

  toggle(): void {
    if (this.playing) {
      this.pause();
    }
    else {
      this.play();
    }
  }

  stop(): void {
    this.#action?.stop();
    this.#state = "stopped";
    this.#changed();
  }

  seek(
    time: number
  ): void {
    const action = this.#action;
    if (action === null || this.#loaded === null) {
      return;
    }

    if (this.#state === "stopped") {
      action.reset().play();
      action.paused = true;
      this.#state = "paused";
    }
    action.time = Math.min(
      Math.max(time, 0),
      action.getClip().duration
    );
    this.#loaded.mixer.update(0);
    this.#changed();
  }

  update(
    deltaTime: number
  ): void {
    this.#loaded?.mixer.update(deltaTime);
  }

  #aim(
    mixer: THREE.AnimationMixer,
    clip: THREE.AnimationClip
  ): void {
    this.#action = mixer.clipAction(clip);
    applyLoop(this.#action, this.#loop);
    this.#state = "stopped";
  }

  #release(): void {
    if (this.#loaded !== null) {
      const { mixer, root } = this.#loaded;
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
    }
    this.#loaded = null;
    this.#action = null;
    this.#state = "stopped";
  }

  #changed(): void {
    this.#requestFrame();
    this.#events.emit("change");
  }
}

function applyLoop(
  action: THREE.AnimationAction,
  loop: boolean
): void {
  action.loop = loop ? THREE.LoopRepeat : THREE.LoopOnce;
  action.clampWhenFinished = !loop;
}
