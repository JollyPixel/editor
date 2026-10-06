// Import Third-party Dependencies
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  AnimationFocusStore,
  AnimationPlaybackStore,
  type TabStore
} from "../../state/index.ts";
import type { EditorHistory } from "../history/index.ts";
import type { ModelBlocks } from "../../scene/index.ts";
import type { BuildRecorder } from "../../model/index.ts";
import {
  AnimationLibrary,
  type AnimationSetSource
} from "./AnimationLibrary.ts";
import { AnimationSession } from "./AnimationSession.ts";
import { AnimationPoser } from "./AnimationPoser.ts";
import { AnimationPlayer } from "./AnimationPlayer.ts";
import { AnimationKeyer } from "./AnimationKeyer.ts";
import {
  AnimationFollow,
  followingBuildEdits
} from "./AnimationFollow.ts";
import { KeyEditor } from "./KeyEditor.ts";

export interface CreateAnimationOptions {
  document: ModelDocument;
  history: EditorHistory;
  tab: TabStore;
  source: AnimationSetSource;
  blocks: ModelBlocks;
  requestFrame(): void;
}

export interface EditorAnimation {
  animations: AnimationLibrary;
  animationFocus: AnimationFocusStore;
  animationSession: AnimationSession;
  keyEditor: KeyEditor;
  keyer: AnimationKeyer;
  buildEdits: BuildRecorder;
  dispose(): void;
}

export function createAnimation(
  options: CreateAnimationOptions
): EditorAnimation {
  const { document, history, tab, source, blocks, requestFrame } = options;
  const animations = new AnimationLibrary({ document, source, history });
  const animationFocus = new AnimationFocusStore();
  const animationSession = new AnimationSession({
    document,
    animations,
    animationFocus,
    animationPlayback: new AnimationPlaybackStore(),
    tab
  });
  const poser = new AnimationPoser({
    document,
    blocks,
    session: animationSession,
    requestFrame
  });
  const player = new AnimationPlayer({ session: animationSession });
  const follow = new AnimationFollow({ document, animations });

  return {
    animations,
    animationFocus,
    animationSession,
    keyEditor: new KeyEditor({ session: animationSession, history }),
    keyer: new AnimationKeyer({
      document,
      history,
      blocks,
      session: animationSession,
      poser
    }),
    buildEdits: followingBuildEdits(history, follow),
    dispose: () => {
      player.dispose();
      poser.dispose();
      animationSession.dispose();
      animations.dispose();
    }
  };
}
