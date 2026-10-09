// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { AnimationDocument } from "@jolly-pixel/asset.voxel-animation/client";
import {
  createBlockTransform,
  ModelDocument
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  AnimationLibrary,
  type AnimationSetSource
} from "#src/features/animation/library/AnimationLibrary.ts";
import { AnimationSession } from "#src/features/animation/session/AnimationSession.ts";
import { KeyEditor } from "#src/features/animation/keys/KeyEditor.ts";
import { AnimationHistories } from "#src/features/animation/undo/AnimationHistories.ts";
import { animateHistoryFocus } from "#src/features/animation/undo/animateHistoryFocus.ts";
import { ClipRemovalFocus } from "#src/features/animation/library/ClipRemovalFocus.ts";
import {
  animationScope,
  createEditorHistory
} from "#src/features/history/index.ts";
import {
  AnimationFocusStore,
  AnimationPlaybackStore,
  BlockSelectionStore,
  PresenceStore,
  TabStore
} from "#src/state/index.ts";

export function createHost(): ReactiveControllerHost & { updates: number; } {
  const host = {
    updates: 0,
    addController: (controller: { hostConnected?(): void; }) => controller.hostConnected?.(),
    removeController: () => undefined,
    requestUpdate: () => {
      host.updates++;
    },
    updateComplete: Promise.resolve(true)
  };

  return host;
}

function createSource(
  set: AnimationDocument
): AnimationSetSource {
  return {
    open: () => {
      return { document: set, release: () => undefined };
    },
    create: () => Promise.reject(new Error("unused")),
    createOwn: () => Promise.reject(new Error("unused")),
    rename: () => Promise.reject(new Error("unused")),
    records: () => [{ id: "walk", kind: "voxelanimation", name: "Walk" }],
    usersOf: () => 1,
    subscribe: () => () => undefined
  };
}

export function createAnimatedModel(
  options: { own?: boolean; } = {}
) {
  const document = new ModelDocument();
  const body = document.addBlock({ name: "Body" })!;
  const limbs = document.addFolder({ name: "Limbs", parentId: body })!;
  const arm = document.addBlock({
    name: "Arm",
    parentId: limbs,
    transform: createBlockTransform({ position: { x: 1, y: 0, z: 0 } })
  })!;
  const set = new AnimationDocument();
  const clipId = set.addClip({ id: "clip", name: "Wave", length: 24000 })!;
  for (const [tick, x] of [[0, 0], [24000, 2]]) {
    set.setKey(clipId, "Body/Arm", "position", { tick, value: { x, y: 0, z: 0 }, interpolation: "linear" });
  }
  const history = createEditorHistory({ document });
  const source = createSource(set);
  const animations = new AnimationLibrary({ document, source });
  const animationFocus = new AnimationFocusStore();
  new AnimationHistories({
    history,
    document,
    animations
  });
  const presence = new PresenceStore();
  new ClipRemovalFocus({ animations, animationFocus, presence });
  if (options.own) {
    document.linkAnimationSet(source.records()[0], { own: true });
  }
  else {
    animations.link("walk");
  }
  animationFocus.focusClip("walk", clipId);
  const animationPlayback = new AnimationPlaybackStore();
  const tab = new TabStore();
  const animationSession = new AnimationSession({
    document,
    animations,
    animationFocus,
    animationPlayback,
    tab
  });
  const selection = new BlockSelectionStore();
  const sets = document.tree.animationSets;

  return {
    document,
    history,
    historyFocus: animateHistoryFocus({ document, animations, animationFocus }),
    clipRef: { setId: "walk", clipId },
    clipScope: animationScope({ setId: "walk", clipId }, sets),
    setScope: animationScope({ setId: "walk", clipId: null }, sets),
    tab,
    set,
    clipId,
    ids: { body, arm },
    animations,
    animationFocus,
    animationPlayback,
    animationSession,
    keyEditor: new KeyEditor({ session: animationSession, history }),
    presence,
    selection
  };
}
