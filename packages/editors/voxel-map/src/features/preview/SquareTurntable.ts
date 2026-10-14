// Import Third-party Dependencies
import type * as THREE from "three";

// Import Internal Dependencies
import { Turntable } from "./Turntable.ts";

export interface TurntableSubject {
  readonly mesh: THREE.Mesh | null;
  refresh(time: number): void;
  dispose(): void;
}

export class SquareTurntable<
  TSubject extends TurntableSubject
> extends Turntable {
  readonly subject: TSubject;
  #size = 0;
  #sizeDirty = true;

  constructor(
    container: HTMLElement,
    subject: TSubject
  ) {
    super(container);
    this.subject = subject;
  }

  override dispose(): void {
    this.subject.dispose();
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

    const { mesh } = this.subject;
    if (this.#size !== 0 && mesh !== null) {
      this.renderMesh(mesh);
    }
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
    this.renderer.setSize(size, size, false);
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
  }
}
