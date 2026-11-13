// Import Third-party Dependencies
import { clamp, wrap } from "@jolly-pixel/utils";

// Import Internal Dependencies
import type { AnimationClipJSON } from "../../network/types.ts";
import { FrameRate } from "./FrameRate.ts";

export type ClipTimelineJSON = Pick<AnimationClipJSON, "length" | "fps" | "loop">;

export class ClipTimeline {
  readonly length: number;
  readonly rate: FrameRate;
  readonly loop: boolean;

  constructor(
    timeline: ClipTimelineJSON
  ) {
    this.length = timeline.length;
    this.rate = new FrameRate(timeline.fps);
    this.loop = timeline.loop;
  }

  tickAt(
    elapsed: number
  ): number {
    return this.loop ?
      wrap(elapsed, this.length) :
      clamp(elapsed, 0, this.length);
  }

  with(
    patch: Partial<ClipTimelineJSON>
  ): ClipTimeline {
    return new ClipTimeline({
      length: patch.length ?? this.length,
      fps: patch.fps ?? this.rate.fps,
      loop: patch.loop ?? this.loop
    });
  }

  toJSON(): ClipTimelineJSON {
    return {
      length: this.length,
      fps: this.rate.fps,
      loop: this.loop
    };
  }
}
