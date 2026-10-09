// Import Third-party Dependencies
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  AnimationFocusStore,
  AnimationPlaybackStore,
  type PresenceStore,
  type TabStore
} from "../../state/index.ts";
import type {
  EditorHistory,
  FocusedHistory
} from "../history/index.ts";
import type { ModelBlocks } from "../../scene/index.ts";
import type { BuildRecorder } from "../../model/index.ts";
import type { LiveView } from "../transform/index.ts";
import { AnimationHistories } from "./undo/AnimationHistories.ts";
import { animateHistoryFocus } from "./undo/animateHistoryFocus.ts";
import { animationLiveView } from "./session/animationLive.ts";
import { ClipRemovalFocus } from "./library/ClipRemovalFocus.ts";
import {
  AnimationLibrary,
  type AnimationSetSource
} from "./library/AnimationLibrary.ts";
import { AnimationSession } from "./session/AnimationSession.ts";
import { AnimationPoser } from "./session/AnimationPoser.ts";
import { AnimationPlayer } from "./session/AnimationPlayer.ts";
import { AnimationKeyer } from "./keys/AnimationKeyer.ts";
import {
  AnimationFollow,
  followingBuildEdits
} from "./library/AnimationFollow.ts";
import { KeyEditor } from "./keys/KeyEditor.ts";

export interface CreateAnimationOptions {
  document: ModelDocument;
  history: EditorHistory;
  tab: TabStore;
  presence: Pick<PresenceStore, "peers" | "subscribe">;
  source: AnimationSetSource;
  blocks: ModelBlocks;
  requestFrame(): void;
}

export interface EditorAnimation {
  animations: AnimationLibrary;
  historyFocus: FocusedHistory;
  animationFocus: AnimationFocusStore;
  clipRemoval: ClipRemovalFocus;
  animationSession: AnimationSession;
  keyEditor: KeyEditor;
  keyer: AnimationKeyer;
  liveView: LiveView;
  buildEdits: BuildRecorder;
  dispose(): void;
}

export function createAnimation(
  options: CreateAnimationOptions
): EditorAnimation {
  const { document, history, tab, presence, source, blocks, requestFrame } = options;
  const animations = new AnimationLibrary({ document, source });
  const animationFocus = new AnimationFocusStore();
  const animationHistories = new AnimationHistories({
    history,
    document,
    animations
  });
  const animationSession = new AnimationSession({
    document,
    animations,
    animationFocus,
    animationPlayback: new AnimationPlaybackStore(),
    tab
  });
  const clipRemoval = new ClipRemovalFocus({ animations, animationFocus, presence });
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
    historyFocus: animateHistoryFocus({ document, animations, animationFocus }),
    animationFocus,
    clipRemoval,
    animationSession,
    keyEditor: new KeyEditor({ session: animationSession, history }),
    keyer: new AnimationKeyer({
      document,
      history,
      blocks,
      session: animationSession,
      poser
    }),
    liveView: animationLiveView(animationSession, poser),
    buildEdits: followingBuildEdits(history, follow),
    dispose: () => {
      player.dispose();
      poser.dispose();
      animationSession.dispose();
      clipRemoval.dispose();
      animationHistories.dispose();
      animations.dispose();
    }
  };
}
