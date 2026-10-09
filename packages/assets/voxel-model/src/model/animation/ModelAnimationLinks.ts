// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON,
  VoxelModelCommand
} from "../../network/types.ts";
import { InvalidModelTreeError } from "../errors/InvalidModelTreeError.ts";
import { AnimationSetLink } from "./AnimationSetLink.ts";

export type AnimationLinkCommand = Extract<
  VoxelModelCommand,
  { action: `animation-${string}`; }
>;

export type ModelAnimationLinksReader = Pick<
  ModelAnimationLinks,
  | "size"
  | "has"
  | "get"
  | "binding"
  | "values"
  | "owned"
>;

export class ModelAnimationLinks {
  #links = new Map<string, AnimationSetLink>();

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
    return this.#links.get(id)?.toJSON();
  }

  binding(
    id: string,
    path: string
  ): AnimationBindingJSON | undefined {
    return this.#links.get(id)?.bindingOf(path);
  }

  * values(): IterableIterator<AnimationSetLinkJSON> {
    for (const link of this.#links.values()) {
      yield link.toJSON();
    }
  }

  get owned(): AnimationSetLinkJSON | undefined {
    return this.#ownedLink()?.toJSON();
  }

  accepts(
    command: AnimationLinkCommand
  ): boolean {
    switch (command.action) {
      case "animation-set-linked":
        return !this.#links.has(command.link.id) &&
          (command.link.own !== true || this.#ownedLink() === undefined) &&
          AnimationSetLink.problemOf(command.link) === null;
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
        this.#links.set(command.link.id, new AnimationSetLink(command.link));
        break;

      case "animation-set-unlinked":
        this.#links.delete(command.id);
        break;

      case "animation-set-owned":
        this.#update(command.id, (link) => link.withOwn(command.own));
        break;

      case "animation-binding-changed":
        this.#update(command.id, (link) => link.rebound(
          command.path,
          [{ path: command.path, target: command.target }]
        ));
        break;

      case "animation-binding-cleared":
        this.#update(command.id, (link) => link.rebound(command.path, []));
        break;
    }
  }

  load(
    links: Iterable<AnimationSetLinkJSON>
  ): void {
    const loaded = new Map<string, AnimationSetLink>();
    for (const json of links) {
      if (loaded.has(json.id)) {
        throw new InvalidModelTreeError("animation-set", json.id, "is linked twice");
      }
      const link = new AnimationSetLink(json);
      if (link.own && [...loaded.values()].some(({ own }) => own)) {
        throw new InvalidModelTreeError("animation-set", json.id, "is a second own set");
      }
      loaded.set(json.id, link);
    }

    this.#links = loaded;
  }

  clear(): void {
    this.#links.clear();
  }

  toJSON(): AnimationSetLinkJSON[] {
    return [...this.values()];
  }

  #ownedLink(): AnimationSetLink | undefined {
    return [...this.#links.values()].find(({ own }) => own);
  }

  #update(
    id: string,
    change: (link: AnimationSetLink) => AnimationSetLink
  ): void {
    const link = this.#links.get(id);
    if (link !== undefined) {
      this.#links.set(id, change(link));
    }
  }
}
