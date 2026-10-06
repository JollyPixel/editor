// Import Third-party Dependencies
import {
  sameTrackPath,
  trackPathKey
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON,
  VoxelModelCommand
} from "../network/types.ts";
import { InvalidModelTreeError } from "./InvalidModelTreeError.ts";

export type AnimationLinkCommand = Extract<
  VoxelModelCommand,
  { action: `animation-${string}`; }
>;

export type ModelAnimationLinksReader = Pick<
  ModelAnimationLinks,
  | "size"
  | "has"
  | "get"
  | "values"
  | "owned"
>;

export class ModelAnimationLinks {
  #links = new Map<string, AnimationSetLinkJSON>();

  get size(): number {
    return this.#links.size;
  }

  has(
    id: string
  ): boolean {
    return this.#links.has(id);
  }

  get(
    id: string
  ): AnimationSetLinkJSON | undefined {
    const link = this.#links.get(id);

    return link === undefined ? undefined : structuredClone(link);
  }

  * values(): IterableIterator<AnimationSetLinkJSON> {
    for (const link of this.#links.values()) {
      yield structuredClone(link);
    }
  }

  get owned(): AnimationSetLinkJSON | undefined {
    const link = this.#ownedLink();

    return link === undefined ? undefined : structuredClone(link);
  }

  accepts(
    command: AnimationLinkCommand
  ): boolean {
    switch (command.action) {
      case "animation-set-linked":
        return !this.#links.has(command.link.id) &&
          (command.link.own !== true || this.#ownedLink() === undefined) &&
          bindingProblem(command.link) === null;
      case "animation-set-unlinked":
        return this.#links.has(command.id);
      case "animation-set-owned": {
        const owner = this.#ownedLink()?.id;

        return this.#links.has(command.id) &&
          (!command.own || owner === undefined || owner === command.id);
      }
      case "animation-binding-changed":
      case "animation-binding-cleared":
        return this.#links.has(command.id);
    }
  }

  apply(
    command: AnimationLinkCommand
  ): void {
    switch (command.action) {
      case "animation-set-linked":
        this.#links.set(command.link.id, structuredClone(command.link));
        break;

      case "animation-set-unlinked":
        this.#links.delete(command.id);
        break;

      case "animation-set-owned": {
        const link = this.#links.get(command.id);
        if (link !== undefined) {
          this.#links.set(command.id, withOwn(link, command.own));
        }
        break;
      }

      case "animation-binding-changed":
        this.#rebind(command.id, command.path, [{ path: command.path, target: command.target }]);
        break;

      case "animation-binding-cleared":
        this.#rebind(command.id, command.path, []);
        break;
    }
  }

  load(
    links: Iterable<AnimationSetLinkJSON>
  ): void {
    const loaded = new Map<string, AnimationSetLinkJSON>();
    for (const link of links) {
      if (loaded.has(link.id)) {
        throw new InvalidModelTreeError("animation-set", link.id, "is linked twice");
      }
      if (link.own === true && [...loaded.values()].some(({ own }) => own === true)) {
        throw new InvalidModelTreeError("animation-set", link.id, "is a second own set");
      }
      const problem = bindingProblem(link);
      if (problem !== null) {
        throw new InvalidModelTreeError("animation-set", link.id, problem);
      }
      loaded.set(link.id, structuredClone(link));
    }

    this.#links = loaded;
  }

  clear(): void {
    this.#links.clear();
  }

  toJSON(): AnimationSetLinkJSON[] {
    return [...this.values()];
  }

  #ownedLink(): AnimationSetLinkJSON | undefined {
    return [...this.#links.values()].find(({ own }) => own === true);
  }

  #rebind(
    id: string,
    path: string,
    bindings: AnimationBindingJSON[]
  ): void {
    const link = this.#links.get(id);
    if (link !== undefined) {
      this.#links.set(id, {
        ...link,
        bindings: [
          ...link.bindings.filter((binding) => !sameTrackPath(binding.path, path)),
          ...bindings
        ]
      });
    }
  }
}

function withOwn(
  link: AnimationSetLinkJSON,
  own: boolean
): AnimationSetLinkJSON {
  const { own: _own, ...shared } = link;

  return own ? { ...shared, own: true } : shared;
}

function bindingProblem(
  link: AnimationSetLinkJSON
): string | null {
  const paths = new Set<string>();
  for (const { path } of link.bindings) {
    const key = trackPathKey(path);
    if (paths.has(key)) {
      return `binds ${path} twice`;
    }
    paths.add(key);
  }

  return null;
}
