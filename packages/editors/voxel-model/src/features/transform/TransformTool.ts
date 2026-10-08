// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type {
  ModelBlock,
  ModelBlocks
} from "../../scene/index.ts";
import type {
  TransformLiveSync,
  TransformLock
} from "./collaboration/index.ts";
import {
  TRANSFORM_MODE_ORDER,
  type GizmoSpace,
  type TransformMode
} from "./gizmo/gizmoTools.ts";

export interface TransformTarget {
  /**
   * In toolbar order.
   */
  readonly modes: readonly TransformMode[];
  begin?(block: ModelBlock): void;
  preview?(block: ModelBlock): void;
  /**
   * A gizmo drag let go of `block`.
   */
  end(block: ModelBlock): void;
  /**
   * A typed value changed `block`.
   */
  commit(block: ModelBlock): void;
}

export type TransformToolEvents = {
  change: () => void;
};

export interface RestTargetOptions {
  blocks: Pick<ModelBlocks, "commitTransform">;
  lock: Pick<TransformLock, "claim" | "release">;
  live: Pick<TransformLiveSync, "publish" | "clear">;
}

export function restTarget(
  options: RestTargetOptions
): TransformTarget {
  const { blocks, lock, live } = options;

  return {
    modes: TRANSFORM_MODE_ORDER,
    begin: (block) => lock.claim(block.uuid),
    preview: (block) => live.publish(block.uuid, block.transform),
    end(block) {
      blocks.commitTransform(block.uuid);
      live.clear();
      lock.release();
    },
    commit: (block) => blocks.commitTransform(block.uuid)
  };
}

export class TransformTool extends Emitter<TransformToolEvents> {
  #mode: TransformMode = "pos";
  #space: GizmoSpace = "local";
  #target: TransformTarget;

  constructor(
    target: TransformTarget
  ) {
    super();
    this.#target = target;
  }

  get mode(): TransformMode {
    return this.#target.modes.includes(this.#mode) ?
      this.#mode :
      this.#target.modes[0];
  }

  set mode(
    mode: TransformMode
  ) {
    if (this.#target.modes.includes(mode) && mode !== this.mode) {
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

  get target(): TransformTarget {
    return this.#target;
  }

  use(
    target: TransformTarget
  ): void {
    if (target !== this.#target) {
      this.#target = target;
      this.emit("change");
    }
  }
}
