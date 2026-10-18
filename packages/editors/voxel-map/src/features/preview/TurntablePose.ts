// Import Internal Dependencies
import {
  PREVIEW_REST_ANGLE,
  type PreviewAngle
} from "./PreviewStage.ts";

// CONSTANTS
const kQuarterTurn = Math.PI / 2;
const kSpinRadiansPerMs = (Math.PI * 2) / 8000;
const kMaxElapsedMs = 100;
const kSettleMs = 60;
const kSettledRadians = 1e-3;

export type QuarterStep = 1 | -1;

export class TurntablePose implements PreviewAngle {
  #yaw = PREVIEW_REST_ANGLE.yaw;
  #pitch = PREVIEW_REST_ANGLE.pitch;
  #targetYaw = PREVIEW_REST_ANGLE.yaw;
  #targetPitch = PREVIEW_REST_ANGLE.pitch;
  #spinning = true;

  get yaw(): number {
    return this.#yaw;
  }

  get pitch(): number {
    return this.#pitch;
  }

  get spinning(): boolean {
    return this.#spinning;
  }

  advance(
    elapsedMs: number
  ): void {
    const elapsed = Math.min(Math.max(elapsedMs, 0), kMaxElapsedMs);
    if (this.#spinning) {
      this.#yaw += kSpinRadiansPerMs * elapsed;
      this.#targetYaw = this.#yaw;

      return;
    }

    const blend = 1 - Math.exp(-elapsed / kSettleMs);
    this.#yaw = settle(this.#yaw, this.#targetYaw, blend);
    this.#pitch = settle(this.#pitch, this.#targetPitch, blend);
  }

  toggle(): void {
    if (this.#spinning) {
      this.pause();
    }
    else {
      this.#spinning = true;
      this.#targetPitch = this.#pitch;
    }
  }

  pause(): void {
    this.#spinning = false;
    this.#targetYaw = this.#yaw;
    this.#targetPitch = this.#pitch;
  }

  turn(
    yawRadians: number,
    pitchRadians: number
  ): void {
    this.pause();
    this.#yaw += yawRadians;
    this.#pitch = clampPitch(this.#pitch + pitchRadians);
    this.#targetYaw = this.#yaw;
    this.#targetPitch = this.#pitch;
  }

  stepYaw(
    direction: QuarterStep
  ): void {
    this.#spinning = false;
    this.#targetYaw = nextQuarter(this.#targetYaw, direction);
  }

  stepPitch(
    direction: QuarterStep
  ): void {
    this.#spinning = false;
    this.#targetPitch = clampPitch(nextQuarter(this.#targetPitch, direction));
  }

  reset(): void {
    this.#yaw = PREVIEW_REST_ANGLE.yaw;
    this.#pitch = PREVIEW_REST_ANGLE.pitch;
    this.#targetYaw = PREVIEW_REST_ANGLE.yaw;
    this.#targetPitch = PREVIEW_REST_ANGLE.pitch;
    this.#spinning = true;
  }
}

function settle(
  current: number,
  target: number,
  blend: number
): number {
  const next = current + ((target - current) * blend);

  return Math.abs(target - next) < kSettledRadians ? target : next;
}

function nextQuarter(
  angle: number,
  direction: QuarterStep
): number {
  const quarters = angle / kQuarterTurn;
  const snapped = direction > 0 ?
    Math.floor(quarters + kSettledRadians) + 1 :
    Math.ceil(quarters - kSettledRadians) - 1;

  return snapped * kQuarterTurn;
}

function clampPitch(
  pitch: number
): number {
  return Math.min(Math.max(pitch, -kQuarterTurn), kQuarterTurn);
}
