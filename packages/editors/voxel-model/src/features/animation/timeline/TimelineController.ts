// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import {
  FrameRate,
  type AnimationClipJSON
} from "@jolly-pixel/asset.voxel-animation/client";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  AnimationSession,
  FocusedAnimation
} from "../session/AnimationSession.ts";
import type { KeyEditor } from "../keys/KeyEditor.ts";
import {
  timelineRows,
  unboundTimelineRows,
  type TimelineRow,
  type UnboundTimelineRow
} from "./timelineRows.ts";
import { keyId } from "./timelineKeys.ts";
import {
  timelinePeers,
  type TimelinePeers
} from "./timelinePeers.ts";
import { keyMenu } from "./keyMenu.ts";
import { rebindMenu } from "../tracks/trackRebind.ts";
import type {
  BlockSelectionStore,
  PresenceStore
} from "../../../state/index.ts";
import {
  EMPTY_MENU,
  type MenuSession
} from "../../../shared/menuSession.ts";

export interface TimelineWorkspace {
  document: ModelDocument;
  animationSession: AnimationSession;
  selection: BlockSelectionStore;
  keyEditor: KeyEditor;
  presence: Pick<PresenceStore, "animateCursors" | "subscribe">;
}

export interface TimelineView extends TimelinePeers {
  clip: AnimationClipJSON;
  /**
   * The clip's length in frames of its fps.
   */
  frames: number;
  rows: TimelineRow[];
  unbound: UnboundTimelineRow[];
  /**
   * `keyId` of every selected diamond.
   */
  selectedKeys: ReadonlySet<string>;
}

export interface TimelinePlayhead {
  /**
   * `fraction` runs from 0 at the clip's start to 1 at its end; `null` past the end.
   */
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
    this.#connection = new SubscriptionController(host, (workspace) => {
      const { animationSession, selection, keyEditor, presence } = workspace;

      return [
        animationSession.subscribe("clip", this.#refresh),
        animationSession.subscribe("playhead", this.#movePlayhead),
        selection.subscribe("select", this.#refresh),
        keyEditor.subscribe("change", this.#refresh),
        presence.subscribe("animateCursorsChange", this.#refreshPeers)
      ];
    });
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
      this.session?.seek(new FrameRate(view.clip.fps).toTick(frame));
    }
  }

  selectBlock(
    blockId: string
  ): void {
    this.#connection.current?.selection.select(blockId);
  }

  pressKey(
    row: Pick<TimelineRow, "blockId" | "path">,
    tick: number,
    additive: boolean
  ): void {
    const selected = this.keys?.select({ path: row.path, tick }, additive);
    if (selected === true) {
      this.selectBlock(row.blockId);
    }
  }

  keyMenu(): MenuSession {
    const keys = this.keys;
    if (keys === undefined || keys.selected.length === 0) {
      return EMPTY_MENU;
    }

    return keyMenu(keys);
  }

  rebindMenu(
    path: string
  ): MenuSession {
    const workspace = this.#connection.current;
    const setId = workspace?.animationSession.focused?.set.id;

    return workspace === null || setId === undefined ?
      EMPTY_MENU :
      rebindMenu(workspace.document, setId, path);
  }

  readonly #refresh = (): void => {
    this.#view = this.#build();
    this.#movePlayhead();
    this.#host.requestUpdate();
  };

  readonly #refreshPeers = (): void => {
    const workspace = this.#connection.current;
    const focused = workspace?.animationSession.focused ?? null;
    if (workspace === null || focused === null || this.#view === null) {
      return;
    }

    this.#view = {
      ...this.#view,
      ...peersOn(workspace, focused)
    };
    this.#host.requestUpdate();
  };

  readonly #movePlayhead = (): void => {
    const workspace = this.#connection.current;
    const view = this.#view;
    if (workspace === null || view === null) {
      return;
    }

    const frame = new FrameRate(view.clip.fps).toFrame(workspace.animationSession.playback.tick);
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
      frames: new FrameRate(clip.fps).frameAt(clip.length),
      rows: timelineRows(workspace.document.tree, clip, link, workspace.selection.selected),
      unbound: unboundTimelineRows(workspace.document.tree, clip, link),
      selectedKeys: new Set(workspace.keyEditor.selected.map(keyId)),
      ...peersOn(workspace, focused)
    };
  }
}

function peersOn(
  workspace: TimelineWorkspace,
  focused: FocusedAnimation
): TimelinePeers {
  return timelinePeers(
    workspace.presence.animateCursors,
    focused.key,
    focused.clip
  );
}
