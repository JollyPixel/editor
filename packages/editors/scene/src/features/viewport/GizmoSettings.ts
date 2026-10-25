// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type GizmoMode = "translate" | "rotate" | "scale";
export type GizmoSpace = "local" | "world";

export type GizmoSettingsEvents = {
  change: () => void;
};

export class GizmoSettings extends Emitter<GizmoSettingsEvents> {
  #mode: GizmoMode = "translate";
  #space: GizmoSpace = "world";

  get mode(): GizmoMode {
    return this.#mode;
  }

  set mode(
    mode: GizmoMode
  ) {
    if (mode !== this.#mode) {
      this.#mode = mode;
      this.emit("change");
    }
  }

  get space(): GizmoSpace {
    return this.#space;
  }

  set space(
    space: GizmoSpace
  ) {
    if (space !== this.#space) {
      this.#space = space;
      this.emit("change");
    }
  }

  toggleSpace(): void {
    this.space = this.#space === "local" ? "world" : "local";
  }
}
