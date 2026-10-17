// Import Third-party Dependencies
import type { AnimationKeyJSON } from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import {
  ActiveHistory,
  ANIMATION_LIBRARY,
  animationScope
} from "#src/features/history/index.ts";
import type { AnimationFocus } from "#src/state/index.ts";
import { createAnimatedModel } from "./fixtures.ts";

type HistoryTarget = AnimationFocus | typeof ANIMATION_LIBRARY;

// CONSTANTS
export const HISTORY_KEY: AnimationKeyJSON = {
  tick: 12000,
  value: { x: 5, y: 0, z: 0 },
  interpolation: "linear"
};

export function createHistoryModel(
  options: { own?: boolean; } = {}
) {
  const model = createAnimatedModel(options);
  const run = model.set.addClip({ id: "run", name: "Run", length: 24000 })!;
  function scope(
    target: HistoryTarget
  ) {
    return target === ANIMATION_LIBRARY ?
      target :
      animationScope(target, model.document.tree.animationSets);
  }

  return {
    ...model,
    wave: model.clipRef,
    run: { setId: "walk", clipId: run },
    walkSet: { setId: "walk", clipId: null },
    state: (target: HistoryTarget) => model.history.state(scope(target)),
    undo: (target: HistoryTarget) => model.history.undo(scope(target)),
    active: () => new ActiveHistory({
      history: model.history,
      tab: model.tab,
      animate: model.historyFocus,
      access: model.access
    }),
    key: (target: { setId: string; clipId: string; }, label: string) => model.history.record(
      scope(target),
      label,
      () => model.set.writeKey(target.clipId, "Body/Arm", "position", HISTORY_KEY)
    ),
    toKey: (clipId: string) => model.set.set.keyAt(clipId, "Body/Arm", "position", HISTORY_KEY.tick)?.value.x
  };
}
