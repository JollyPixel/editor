// Import Third-party Dependencies
import type { Mode } from "@jolly-pixel/pixel-draw.renderer";

export type UvAccess = "edit" | "view" | "none";

export class UvAccessPolicy {
  static readonly #policies: Readonly<Record<UvAccess, UvAccessPolicy>> = {
    edit: new UvAccessPolicy("edit"),
    view: new UvAccessPolicy("view"),
    none: new UvAccessPolicy("none")
  };

  static of(
    access: UvAccess
  ): UvAccessPolicy {
    return UvAccessPolicy.#policies[access];
  }

  static isAccess(
    value: string
  ): value is UvAccess {
    return Object.hasOwn(UvAccessPolicy.#policies, value);
  }

  readonly access: UvAccess;
  readonly uvMode: boolean;
  readonly visibilityInBottomBar: boolean;
  readonly fillClip: boolean;

  constructor(
    access: UvAccess
  ) {
    this.access = access;
    this.uvMode = access === "edit";
    this.visibilityInBottomBar = access === "view";
    this.fillClip = access !== "none";
    Object.freeze(this);
  }

  constrain(
    mode: Mode
  ): Mode {
    return mode === "uv" && !this.uvMode ? "paint" : mode;
  }
}
