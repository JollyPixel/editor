// Import Third-party Dependencies
import {
  animationHistoryKeys,
  type AnimationChange,
  type AnimationDocument
} from "@jolly-pixel/asset.voxel-animation/client";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { animationKey } from "../../../state/index.ts";
import type { EditorHistory } from "../../history/index.ts";
import { describeAnimationChange } from "./describeAnimationChange.ts";
import { scopeOfAnimationChange } from "./scopeOfAnimationChange.ts";
import { combineReleases } from "../../../shared/combineReleases.ts";
import type {
  AnimationLibrary,
  OpenedAnimationSet
} from "../library/AnimationLibrary.ts";

export interface AnimationHistoriesOptions {
  history: Pick<EditorHistory, "register" | "removeScope">;
  document: Pick<ModelDocument, "tree">;
  animations: Pick<AnimationLibrary, "sets" | "subscribe">;
}

interface OpenSetHistory {
  document: AnimationDocument;
  unregister: () => void;
}

export class AnimationHistories {
  #history: AnimationHistoriesOptions["history"];
  #document: AnimationHistoriesOptions["document"];
  #open = new Map<string, OpenSetHistory>();
  #release: () => void;

  constructor(
    options: AnimationHistoriesOptions
  ) {
    this.#history = options.history;
    this.#document = options.document;
    const { animations } = options;
    this.#release = combineReleases([
      animations.subscribe("setOpened", this.#openSet),
      animations.subscribe("setClosed", this.#close),
      animations.subscribe("setChange", this.#dropRemovedClip)
    ]);
    for (const set of animations.sets()) {
      this.#openSet(set);
    }
  }

  dispose(): void {
    this.#release();
    for (const setId of [...this.#open.keys()]) {
      this.#close(setId);
    }
  }

  readonly #openSet = (
    set: OpenedAnimationSet
  ): void => {
    const { id: setId, document } = set;
    this.#open.set(setId, {
      document,
      unregister: this.#history.register({
        id: animationKey(setId),
        document,
        keys: animationHistoryKeys(document.set),
        scopeOf: (change) => scopeOfAnimationChange(
          change,
          setId,
          this.#document.tree.animationSets
        ),
        label: describeAnimationChange
      })
    });
  };

  readonly #dropRemovedClip = (
    setId: string,
    { command }: Pick<AnimationChange, "command">
  ): void => {
    if (command.action === "clip-removed") {
      this.#history.removeScope(animationKey(setId, command.id));
    }
  };

  readonly #close = (
    setId: string
  ): void => {
    const open = this.#open.get(setId);
    if (open === undefined) {
      return;
    }

    this.#open.delete(setId);
    open.unregister();
    this.#history.removeScope(animationKey(setId));
    for (const { id: clipId } of open.document.set.clips()) {
      this.#history.removeScope(animationKey(setId, clipId));
    }
  };
}
