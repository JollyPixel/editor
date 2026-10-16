// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { Turntable } from "./Turntable.ts";
import {
  PREVIEW_ROTATION_STEP,
  type PreviewStage
} from "./PreviewStage.ts";

export interface TurntableSubject {
  readonly mesh: THREE.Mesh | null;
  refresh(time: number): void;
  dispose(): void;
}

export class SquareTurntable<
  TSubject extends TurntableSubject
> extends Turntable {
  readonly subject: TSubject;
  readonly #target: THREE.RenderTarget;
  #size = 0;
  #sizeDirty = true;
  #rotation = 0;
  #capturing = false;

  constructor(
    container: HTMLElement,
    stage: PreviewStage,
    subject: TSubject
  ) {
    super(container, stage);
    this.subject = subject;
    this.#target = stage.createTarget();
  }

  override dispose(): void {
    this.subject.dispose();
    this.#target.dispose();
    super.dispose();
  }

  protected override refresh(
    time: number
  ): void {
    this.subject.refresh(time);
  }

  protected override resized(): void {
    this.#sizeDirty = true;
  }

  protected override draw(): void {
    if (this.#sizeDirty) {
      this.#fit();
    }

    this.#rotation += PREVIEW_ROTATION_STEP;
    const { mesh } = this.subject;
    if (this.#size === 0 || mesh === null || this.#capturing) {
      return;
    }

    const size = this.#size;
    this.#capturing = true;
    this.stage.capture(this.#target, mesh, this.#rotation)
      .then((image) => {
        if (size === this.#size) {
          this.context?.putImageData(image, 0, 0);
        }
      })
      .finally(() => {
        this.#capturing = false;
      });
  }

  #fit(): void {
    this.#sizeDirty = false;

    const size = Math.floor(
      Math.min(this.container.clientWidth, this.container.clientHeight)
    );
    if (size === this.#size) {
      return;
    }

    this.#size = size;
    const pixels = size * this.stage.pixelRatio;
    this.#target.setSize(pixels, pixels);
    this.canvas.width = pixels;
    this.canvas.height = pixels;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
  }
}
