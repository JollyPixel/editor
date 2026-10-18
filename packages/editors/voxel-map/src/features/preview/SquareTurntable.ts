// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { Turntable } from "./Turntable.ts";
import type {
  PreviewAngle,
  PreviewStage
} from "./PreviewStage.ts";
import { TurntablePose } from "./TurntablePose.ts";
import { TurntableOrbit } from "./TurntableOrbit.ts";
import { SpinToggle } from "./SpinToggle.ts";

export interface TurntableSubject {
  readonly mesh: THREE.Mesh | null;
  refresh(time: number): void;
  dispose(): void;
}

interface TurntableFrame extends PreviewAngle {
  readonly mesh: THREE.Mesh;
  readonly size: number;
}

export class SquareTurntable<
  TSubject extends TurntableSubject
> extends Turntable {
  readonly subject: TSubject;

  readonly #target: THREE.RenderTarget;
  readonly #pose = new TurntablePose();
  readonly #orbit: TurntableOrbit;
  readonly #spinToggle: SpinToggle;
  readonly #stopWatchingCompiles: () => void;
  #size = 0;
  #sizeDirty = true;
  #capturing = false;
  #drawn: TurntableFrame | null = null;
  #time: number | null = null;

  constructor(
    container: HTMLElement,
    stage: PreviewStage,
    subject: TSubject
  ) {
    super(container, stage);
    this.subject = subject;
    this.#target = stage.createTarget();
    this.#orbit = new TurntableOrbit(this.canvas, this.#pose);
    this.#spinToggle = new SpinToggle(container, this.#pose);
    this.#stopWatchingCompiles = stage.watchCompiles(() => {
      this.#drawn = null;
    });
  }

  override dispose(): void {
    this.#stopWatchingCompiles();
    this.#orbit.dispose();
    this.#spinToggle.dispose();
    this.subject.dispose();
    this.#target.dispose();
    super.dispose();
  }

  protected override refresh(
    time: number
  ): void {
    this.subject.refresh(time);
    this.#pose.advance(this.#time === null ? 0 : time - this.#time);
    this.#time = time;
  }

  protected override resized(): void {
    this.#sizeDirty = true;
  }

  protected override draw(): void {
    if (this.#sizeDirty) {
      this.#fit();
    }
    this.#spinToggle.sync();

    const { mesh } = this.subject;
    if (
      this.#size === 0 ||
      mesh === null ||
      this.#capturing ||
      this.#isDrawn(mesh)
    ) {
      return;
    }

    const frame: TurntableFrame = {
      mesh,
      size: this.#size,
      yaw: this.#pose.yaw,
      pitch: this.#pose.pitch
    };
    this.#drawn = frame;
    this.#capturing = true;
    this.stage.capture(this.#target, mesh, frame)
      .then((image) => {
        if (frame.size === this.#size) {
          this.context?.putImageData(image, 0, 0);
        }
      })
      .finally(() => {
        this.#capturing = false;
      });
  }

  #isDrawn(
    mesh: THREE.Mesh
  ): boolean {
    const drawn = this.#drawn;

    return drawn !== null &&
      drawn.mesh === mesh &&
      drawn.size === this.#size &&
      drawn.yaw === this.#pose.yaw &&
      drawn.pitch === this.#pose.pitch;
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
