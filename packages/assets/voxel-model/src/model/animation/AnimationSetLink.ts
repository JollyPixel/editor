// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";
import {
  TrackMap,
  TrackPath
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON
} from "../../network/types.ts";

type AnimationSetLinkHeader = Omit<AnimationSetLinkJSON, "bindings">;

export class AnimationSetLink {
  static findProblem(
    link: AnimationSetLinkJSON
  ): string | null {
    const repeated = TrackPath.findRepeated(link.bindings.map(({ path }) => path));

    return repeated === undefined ? null : `binds ${repeated} twice`;
  }

  static parse(
    link: AnimationSetLinkJSON
  ): AnimationSetLink {
    const problem = AnimationSetLink.findProblem(link);
    if (problem !== null) {
      throw new InvalidEntryError("animation-set", link.id, problem);
    }

    const { bindings, ...header } = structuredClone(link);

    return new AnimationSetLink(header, new TrackMap(bindings));
  }

  readonly #header: AnimationSetLinkHeader;
  readonly #bindings: TrackMap<AnimationBindingJSON>;

  constructor(
    header: AnimationSetLinkHeader,
    bindings: TrackMap<AnimationBindingJSON>
  ) {
    this.#header = header;
    this.#bindings = bindings;
  }

  get id(): string {
    return this.#header.id;
  }

  get own(): boolean {
    return this.#header.own === true;
  }

  findBinding(
    path: string
  ): AnimationBindingJSON | undefined {
    const binding = this.#bindings.get(path);

    return binding === undefined ? undefined : { ...binding };
  }

  pathTargeting(
    blockPath: string
  ): string | undefined {
    const block = new TrackPath(blockPath);
    for (const { path, target } of this.#bindings) {
      if (target !== null && block.equals(target)) {
        return path;
      }
    }

    return undefined;
  }

  withOwn(
    own: boolean
  ): AnimationSetLink {
    const { own: _own, ...shared } = this.#header;

    return new AnimationSetLink(own ? { ...shared, own: true } : shared, this.#bindings);
  }

  withBinding(
    binding: AnimationBindingJSON
  ): AnimationSetLink {
    return new AnimationSetLink(this.#header, this.#bindings.with({ ...binding }));
  }

  withoutBinding(
    path: string
  ): AnimationSetLink {
    return new AnimationSetLink(this.#header, this.#bindings.without(path));
  }

  toJSON(): AnimationSetLinkJSON {
    return {
      ...this.#header,
      bindings: [...this.#bindings].map((binding) => {
        return { ...binding };
      })
    };
  }
}
