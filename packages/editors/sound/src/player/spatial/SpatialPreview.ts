// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/ecs";

// Import Internal Dependencies
import type { PlaybackMode } from "../PlaybackMode.ts";
import type { PlaybackTuning } from "../PlaybackTuning.ts";
import { DistanceFalloff } from "./DistanceFalloff.ts";
import type { PlanePoint } from "./PlanePoint.ts";

export interface SpatialTransport {
  readonly mode: PlaybackMode;
  readonly settings: Readonly<Systems.SoundSettings>;
  readonly playing: boolean;
  readonly position: number;
  tune(mode: PlaybackMode): PlaybackTuning | null;
  subscribe(event: "change" | "settings", listener: () => void): () => void;
}

// CONSTANTS
const kPlaceSmoothing = 0.03;
const kMinMaxDistance = 1e-4;
const kMotionTickMs = 30;

export class SpatialPreview {
  readonly input: GainNode;

  #context: BaseAudioContext;
  #transport: SpatialTransport;
  #panner: PannerNode;
  #output: AudioNode;
  #heard = false;
  #motion: ReturnType<typeof setInterval> | null = null;
  #unsubscribe: Array<() => void>;

  constructor(
    context: BaseAudioContext,
    output: AudioNode,
    transport: SpatialTransport
  ) {
    this.#context = context;
    this.#output = output;
    this.#transport = transport;
    this.input = context.createGain();
    this.input.connect(output);
    this.#panner = context.createPanner();
    this.#panner.panningModel = "HRTF";
    this.#panner.connect(output);
    this.#unsubscribe = [
      transport.subscribe("change", () => this.#update()),
      transport.subscribe("settings", () => this.#update())
    ];
  }

  get moving(): boolean {
    const { mode, playing } = this.#transport;

    return playing && mode.spatial && mode.placement.motion !== "still";
  }

  falloff(): DistanceFalloff {
    return new DistanceFalloff(this.#transport.settings.spatial);
  }

  sourcePoint(): PlanePoint | null {
    const { mode, position } = this.#transport;
    if (!mode.spatial) {
      return null;
    }

    const progress = this.#transport.tune(mode)?.progress(position) ?? 0;

    return mode.placement.pointAt(progress, this.falloff().reach());
  }

  dispose(): void {
    for (const unsubscribe of this.#unsubscribe) {
      unsubscribe();
    }
    this.#pace(false);
    this.input.disconnect();
    this.#panner.disconnect();
  }

  #update(): void {
    const point = this.sourcePoint();
    if (point === null) {
      this.#route(false);
    }
    else {
      this.#hear(point);
    }
    this.#pace(this.moving);
  }

  #hear(
    point: PlanePoint
  ): void {
    const { spatial } = this.#transport.settings;
    const panner = this.#panner;
    panner.distanceModel = spatial.distanceModel;
    panner.refDistance = spatial.refDistance;
    panner.maxDistance = Math.max(spatial.maxDistance, kMinMaxDistance);
    panner.rolloffFactor = spatial.rolloffFactor;
    this.#place(point);
    this.#route(true);
  }

  #place(
    point: PlanePoint
  ): void {
    const now = this.#context.currentTime;
    const { positionX, positionZ } = this.#panner;
    for (const [param, value] of [
      [positionX, point.x],
      [positionZ, point.z]
    ] as const) {
      if (this.#heard) {
        param.setTargetAtTime(value, now, kPlaceSmoothing);
      }
      else {
        param.cancelScheduledValues(now);
        param.setValueAtTime(value, now);
      }
    }
  }

  #route(
    heard: boolean
  ): void {
    if (heard !== this.#heard) {
      this.#heard = heard;
      this.input.disconnect();
      this.input.connect(heard ? this.#panner : this.#output);
    }
  }

  #pace(
    moving: boolean
  ): void {
    if (moving) {
      this.#motion ??= setInterval(() => this.#update(), kMotionTickMs);
    }
    else if (this.#motion !== null) {
      clearInterval(this.#motion);
      this.#motion = null;
    }
  }
}
