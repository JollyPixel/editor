// Import Third-party Dependencies
import { InvalidEntryError } from "@jolly-pixel/asset.common";

// Import Internal Dependencies
import type {
  AnimationBindingJSON,
  AnimationSetLinkJSON
} from "../types.ts";
import { AnimationSetLink } from "./AnimationSetLink.ts";

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
    return this.#links.get(id)?.findBinding(path);
  }

  * values(): IterableIterator<AnimationSetLinkJSON> {
    for (const link of this.#links.values()) {
      yield link.toJSON();
    }
  }

  get owned(): AnimationSetLinkJSON | undefined {
    return this.#ownedLink()?.toJSON();
  }

  link(
    json: AnimationSetLinkJSON
  ): void {
    this.#links.set(json.id, AnimationSetLink.parse(json));
  }

  unlink(
    id: string
  ): void {
    this.#links.delete(id);
  }

  update(
    id: string,
    change: (link: AnimationSetLink) => AnimationSetLink
  ): void {
    const link = this.#links.get(id);
    if (link !== undefined) {
      this.#links.set(id, change(link));
    }
  }

  load(
    links: Iterable<AnimationSetLinkJSON>
  ): void {
    const loaded = new Map<string, AnimationSetLink>();
    for (const json of links) {
      if (loaded.has(json.id)) {
        throw new InvalidEntryError("animation-set", json.id, "is linked twice");
      }
      const link = AnimationSetLink.parse(json);
      if (link.own && [...loaded.values()].some(({ own }) => own)) {
        throw new InvalidEntryError("animation-set", json.id, "is a second own set");
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
}
