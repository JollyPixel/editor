// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import {
  frameAt,
  frameToTick,
  tickToFrame,
  type AnimationClipJSON
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { AnimationSession } from "../AnimationSession.ts";
import type { KeyEditor } from "../KeyEditor.ts";
import {
  timelineRows,
  unboundTimelineRows,
  type TimelineRow,
  type UnboundTimelineRow
} from "./timelineRows.ts";
import { keyId } from "./timelineKeys.ts";
import {
  rebindMenu,
  type TrackRebindWorkspace
} from "../trackRebind.ts";
import type { BlockSelectionStore } from "../../../state/index.ts";
import {
  EMPTY_MENU,
  type MenuSession
} from "../../../shared/menuSession.ts";

export interface TimelineWorkspace extends TrackRebindWorkspace {
  animationSession: AnimationSession;
  selection: BlockSelectionStore;
  keyEditor: KeyEditor;
}

export interface TimelineView {
  clip: AnimationClipJSON;
  /** The clip's length in frames of its fps. */
  frames: number;
  rows: TimelineRow[];
  unbound: UnboundTimelineRow[];
  /** `keyId` of every selected diamond. */
  selectedKeys: ReadonlySet<string>;
}

export interface TimelinePlayhead {
  /** `fraction` runs from 0 at the clip's start to 1 at its end; `null` past the end. */
  showPlayhead(fraction: number | null): void;
}

export class TimelineController {
  #host: ReactiveControllerHost;
  #playhead: TimelinePlayhead;
  #view: TimelineView | null = null;
  #connection: SubscriptionController<TimelineWorkspace>;

  constructor(
    host: ReactiveControllerHost,
    playhead: TimelinePlayhead
  ) {
    this.#host = host;
    this.#playhead = playhead;
    this.#connection = new SubscriptionController(host, ({ animationSession, selection, keyEditor }) => [
      animationSession.subscribe("clip", this.#refresh),
      animationSession.subscribe("playhead", this.#movePlayhead),
      selection.subscribe("select", this.#refresh),
      keyEditor.subscribe("change", this.#refresh)
    ]);
  }

  get view(): TimelineView | null {
    return this.#view;
  }

  attach(
    workspace: TimelineWorkspace
  ): void {
    this.#connection.attach(workspace);
    this.#refresh();
  }

  get session(): AnimationSession | undefined {
    return this.#connection.current?.animationSession;
  }

  get keys(): KeyEditor | undefined {
    return this.#connection.current?.keyEditor;
  }

  seekFraction(
    fraction: number
  ): void {
    const view = this.#view;
    if (view !== null) {
      const frame = Math.round(Math.min(Math.max(fraction, 0), 1) * view.frames);
      this.session?.seek(frameToTick(frame, view.clip.fps));
    }
  }

  selectBlock(
    blockId: string
  ): void {
    this.#connection.current?.selection.select(blockId);
  }

  rebindMenu(
    path: string
  ): MenuSession {
    const workspace = this.#connection.current;
    const setId = workspace?.animationSession.focused?.set.id;

    return workspace === null || setId === undefined ?
      EMPTY_MENU :
      rebindMenu(workspace, setId, path);
  }

  readonly #refresh = (): void => {
    this.#view = this.#build();
    this.#movePlayhead();
    this.#host.requestUpdate();
  };

  readonly #movePlayhead = (): void => {
    const workspace = this.#connection.current;
    const view = this.#view;
    if (workspace === null || view === null) {
      return;
    }

    const frame = tickToFrame(workspace.animationSession.playback.tick, view.clip.fps);
    if (frame > view.frames) {
      this.#playhead.showPlayhead(null);
    }
    else {
      this.#playhead.showPlayhead(view.frames === 0 ? 0 : frame / view.frames);
    }
  };

  #build(): TimelineView | null {
    const workspace = this.#connection.current;
    const focused = workspace?.animationSession.focused ?? null;
    if (workspace === null || focused === null) {
      return null;
    }

    const { clip, link } = focused;

    return {
      clip,
      frames: frameAt(clip.length, clip.fps),
      rows: timelineRows(workspace.document.tree, clip, link, workspace.selection.selected),
      unbound: unboundTimelineRows(workspace.document.tree, clip, link),
      selectedKeys: new Set(workspace.keyEditor.selected.map(keyId))
    };
  }
}
