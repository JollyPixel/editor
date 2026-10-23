// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { SubscriptionController, MenuSession } from "@jolly-pixel/ui";
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

export interface TimelineEditing {
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
  showPlayhead(fraction: number | null): void;
}

export class TimelineController {
  #host: ReactiveControllerHost;
  #playhead: TimelinePlayhead;
  #view: TimelineView | null = null;
  #connection: SubscriptionController<TimelineEditing>;

  constructor(
    host: ReactiveControllerHost,
    playhead: TimelinePlayhead
  ) {
    this.#host = host;
    this.#playhead = playhead;
    this.#connection = new SubscriptionController(host, (editing) => {
      const { animationSession, selection, keyEditor, presence } = editing;

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
    editing: TimelineEditing
  ): void {
    this.#connection.attach(editing);
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
      return MenuSession.EMPTY;
    }

    return keyMenu(keys);
  }

  rebindMenu(
    path: string
  ): MenuSession {
    const editing = this.#connection.current;
    const setId = editing?.animationSession.focused?.set.id;

    return editing === null || setId === undefined || !editing.keyEditor.editable ?
      MenuSession.EMPTY :
      rebindMenu(editing.document, setId, path);
  }

  readonly #refresh = (): void => {
    this.#view = this.#build();
    this.#movePlayhead();
    this.#host.requestUpdate();
  };

  readonly #refreshPeers = (): void => {
    const editing = this.#connection.current;
    const focused = editing?.animationSession.focused ?? null;
    if (editing === null || focused === null || this.#view === null) {
      return;
    }

    this.#view = {
      ...this.#view,
      ...peersOn(editing, focused)
    };
    this.#host.requestUpdate();
  };

  readonly #movePlayhead = (): void => {
    const editing = this.#connection.current;
    const view = this.#view;
    if (editing === null || view === null) {
      return;
    }

    const frame = new FrameRate(view.clip.fps).toFrame(editing.animationSession.playback.tick);
    if (frame > view.frames) {
      this.#playhead.showPlayhead(null);
    }
    else {
      this.#playhead.showPlayhead(view.frames === 0 ? 0 : frame / view.frames);
    }
  };

  #build(): TimelineView | null {
    const editing = this.#connection.current;
    const focused = editing?.animationSession.focused ?? null;
    if (editing === null || focused === null) {
      return null;
    }

    const { clip, link } = focused;

    return {
      clip,
      frames: new FrameRate(clip.fps).frameAt(clip.length),
      rows: timelineRows(editing.document.tree, clip, link, editing.selection.selected),
      unbound: unboundTimelineRows(editing.document.tree, clip, link),
      selectedKeys: new Set(editing.keyEditor.selected.map(keyId)),
      ...peersOn(editing, focused)
    };
  }
}

function peersOn(
  editing: TimelineEditing,
  focused: FocusedAnimation
): TimelinePeers {
  return timelinePeers(
    editing.presence.animateCursors,
    focused.key,
    focused.clip
  );
}
