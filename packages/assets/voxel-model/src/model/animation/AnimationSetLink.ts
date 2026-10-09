// Import Third-party Dependencies
import { TrackPath } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON
} from "../../network/types.ts";
import { InvalidModelTreeError } from "../errors/InvalidModelTreeError.ts";

export class AnimationSetLink {
  static problemOf(
    link: AnimationSetLinkJSON
  ): string | null {
    const paths = new Set<string>();
    for (const { path } of link.bindings) {
      const { key } = new TrackPath(path);
      if (paths.has(key)) {
        return `binds ${path} twice`;
      }
      paths.add(key);
    }

    return null;
  }

  readonly #json: AnimationSetLinkJSON;

  constructor(
    link: AnimationSetLinkJSON
  ) {
    const problem = AnimationSetLink.problemOf(link);
    if (problem !== null) {
      throw new InvalidModelTreeError("animation-set", link.id, problem);
    }

    this.#json = structuredClone(link);
  }

  get id(): string {
    return this.#json.id;
  }

  get own(): boolean {
    return this.#json.own === true;
  }

  bindingOf(
    path: string
  ): AnimationBindingJSON | undefined {
    const track = new TrackPath(path);
    const binding = this.#json.bindings.find((candidate) => track.equals(candidate.path));

    return binding === undefined ? undefined : { ...binding };
  }

  pathTargeting(
    blockPath: string
  ): string | undefined {
    const block = new TrackPath(blockPath);

    return this.#json.bindings.find(({ target }) => target !== null && block.equals(target))?.path;
  }

  withOwn(
    own: boolean
  ): AnimationSetLink {
    const { own: _own, ...shared } = this.#json;

    return new AnimationSetLink(own ? { ...shared, own: true } : shared);
  }

  rebound(
    path: string,
    bindings: AnimationBindingJSON[]
  ): AnimationSetLink {
    const replaced = new TrackPath(path);

    return new AnimationSetLink({
      ...this.#json,
      bindings: [
        ...this.#json.bindings.filter((binding) => !replaced.equals(binding.path)),
        ...bindings
      ]
    });
  }

  toJSON(): AnimationSetLinkJSON {
    return structuredClone(this.#json);
  }
}
