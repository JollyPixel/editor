// Import Internal Dependencies
import type { TurntablePose } from "./TurntablePose.ts";
import "./previewIcons.ts";

export class SpinToggle {
  readonly #pose: TurntablePose;
  readonly #button = document.createElement("button");
  readonly #icon = document.createElement("jolly-icon");
  #shown = false;

  constructor(
    container: HTMLElement,
    pose: TurntablePose
  ) {
    this.#pose = pose;
    this.#button.type = "button";
    this.#button.className = "toggle trailing";
    this.#button.addEventListener("click", () => pose.toggle());
    this.#icon.setAttribute("aria-hidden", "true");
    this.#button.append(this.#icon);
    container.append(this.#button);
    this.#show(pose.spinning);
  }

  sync(): void {
    const { spinning } = this.#pose;
    if (spinning !== this.#shown) {
      this.#show(spinning);
    }
  }

  dispose(): void {
    this.#button.remove();
  }

  #show(
    spinning: boolean
  ): void {
    this.#shown = spinning;
    this.#icon.name = spinning ? "preview-pause" : "preview-play";
    this.#button.setAttribute(
      "aria-label",
      spinning ? "Pause rotation" : "Resume rotation"
    );
  }
}
