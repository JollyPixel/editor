// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  resolveReparentMoves,
  SubscriptionController,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type TreeNode
} from "@jolly-pixel/ui";
import {
  FrameRate,
  type AnimationClipJSON,
  type AnimationClipPatchJSON
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { LinkedAnimationSet } from "./library/AnimationLibrary.ts";
import type { ClipRemovalFocus } from "./library/ClipRemovalFocus.ts";
import {
  AnimateActions,
  type AnimateActionsView,
  type AnimateActionsWorkspace
} from "./library/AnimateActions.ts";
import {
  keySelectedBlock,
  type KeySelectedOptions
} from "./keys/animationShortcuts.ts";
import {
  EMPTY_MENU,
  menuSession,
  rowMenuSession,
  type MenuPoint,
  type MenuSession
} from "../../shared/menuSession.ts";
import { ExpandedRows } from "../../shared/ExpandedRows.ts";
import {
  animationKey,
  type PresenceStore
} from "../../state/index.ts";
import {
  clipMenu,
  ownMenu,
  SET_MENU,
  SHARED_MENU,
  type ClipAction,
  type SetAction
} from "./library/animateMenu.ts";
import {
  asClipRow,
  clipNodes,
  findRow,
  selectedRow,
  setNode,
  type ClipRow,
  type RowTarget
} from "./library/animateRows.ts";

// CONSTANTS
export const CLIP_FRAME_RATES = [12, 15, 24, 25, 30, 48, 60] as const;
const kEmptyState: AnimatePanelState = {
  ownClips: [],
  sharedSets: [],
  expanded: [],
  selectedId: null,
  set: null,
  clip: null,
  canShare: false,
  error: null,
  notice: null
};

export interface AnimateWorkspace extends AnimateActionsWorkspace, KeySelectedOptions {
  presence: Pick<PresenceStore, "clipFocuses" | "subscribe">;
  clipRemoval: Pick<ClipRemovalFocus, "notice" | "dismiss" | "subscribe">;
}

export interface AnimatePanelView extends AnimateActionsView {
  beginRename(
    rowId: string
  ): void;
}

export type AnimateSection = "own" | "shared";

export interface FocusedClip {
  setId: string;
  clip: AnimationClipJSON;
  frames: number;
}

export interface AnimatePanelState {
  ownClips: TreeNode<RowTarget>[];
  sharedSets: TreeNode<RowTarget>[];
  expanded: string[];
  selectedId: string | null;
  set: LinkedAnimationSet | null;
  clip: FocusedClip | null;
  /**
   * The model has clips of its own, which can become a shared set.
   */
  canShare: boolean;
  /**
   * Why the last action failed, until the next one succeeds.
   */
  error: string | null;
  /**
   * Why the focus moved, until it moves again.
   */
  notice: string | null;
}

export class AnimatePanelController {
  #host: ReactiveControllerHost;
  #view: AnimatePanelView;
  #expanded = new ExpandedRows();
  #state: AnimatePanelState = kEmptyState;
  #error: string | null = null;
  #actions: AnimateActions | null = null;
  #connection: SubscriptionController<AnimateWorkspace>;

  constructor(
    host: ReactiveControllerHost,
    view: AnimatePanelView
  ) {
    this.#host = host;
    this.#view = view;
    this.#connection = new SubscriptionController(host, (workspace) => {
      const { animations, animationFocus, presence, clipRemoval } = workspace;

      return [
        animations.subscribe("change", this.#refresh),
        animationFocus.subscribe("change", this.#refresh),
        presence.subscribe("clipFocusesChange", this.#refresh),
        clipRemoval.subscribe("change", this.#refresh)
      ];
    });
  }

  get state(): AnimatePanelState {
    return this.#state;
  }

  get actions(): AnimateActions | null {
    return this.#actions;
  }

  attach(
    workspace: AnimateWorkspace
  ): void {
    this.#expanded.reset(
      workspace.animations.sets().map(({ id }) => animationKey(id))
    );
    this.#actions = new AnimateActions({
      workspace,
      view: this.#view,
      expand: (setId) => this.#expanded.expand(animationKey(setId)),
      report: this.#report
    });
    this.#connection.attach(workspace);
    this.#refresh();
  }

  readonly handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    const row = this.#findRow(event.detail.selected[0]);
    const workspace = this.#connection.current;
    if (row === undefined || workspace === null) {
      return;
    }

    const focus = workspace.animationFocus;
    workspace.clipRemoval.dismiss();
    if (row.clipId === null) {
      focus.focusSet(row.setId);
    }
    else {
      focus.focusClip(row.setId, row.clipId);
    }
  };

  readonly handleToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    this.#expanded.set(event.detail.id, event.detail.expanded);
    this.#refresh();
  };

  readonly handleRename = (
    event: CustomEvent<JollyRenameDetail>
  ): void => {
    const row = asClipRow(this.#findRow(event.detail.id));
    if (row !== null) {
      this.#actions?.renameClip(row, event.detail.name);
    }
  };

  readonly validateRename = (
    detail: JollyRenameDetail
  ): string | null => {
    const row = asClipRow(this.#findRow(detail.id));

    return row === null ?
      null :
      this.#actions?.nameRule(row.target, row.clipId)(detail.name) ?? null;
  };

  acceptDrop(
    section: AnimateSection
  ): (detail: JollyReparentDetail) => boolean {
    return ({ movedIds, targetId, where }) => {
      const nodes = this.#nodesOf(section);
      const target = asClipRow(findRow(nodes, targetId));

      return target !== null && where !== "inside" && movedIds.every(
        (id) => findRow(nodes, id)?.setId === target.setId && asClipRow(findRow(nodes, id)) !== null
      );
    };
  }

  handleReparent(
    section: AnimateSection,
    event: CustomEvent<JollyReparentDetail>
  ): void {
    const nodes = this.#nodesOf(section);
    const [move] = resolveReparentMoves({ nodes, ...event.detail });
    const row = asClipRow(findRow(nodes, move?.id));
    if (move !== undefined && row !== null) {
      this.#actions?.reorder(row, findRow(nodes, move.beforeId)?.clipId ?? undefined);
    }
  }

  rowMenu(
    rowId: string
  ): MenuSession {
    const actions = this.#actions;
    const row = this.#findRow(rowId);
    if (actions === null || row === undefined) {
      return EMPTY_MENU;
    }

    const exists = (): boolean => this.#findRow(rowId) !== undefined;
    const clipRow = asClipRow(row);
    if (clipRow === null) {
      return rowMenuSession(SET_MENU, exists, (action) => this.#setAction(actions, action, row.setId));
    }

    return rowMenuSession(
      clipMenu(actions.copyTargets(clipRow).length > 0),
      exists,
      (action, point) => this.#clipAction(actions, action, clipRow, rowId, point)
    );
  }

  sectionMenu(
    section: AnimateSection
  ): MenuSession {
    const actions = this.#actions;
    if (actions === null) {
      return EMPTY_MENU;
    }

    return section === "own" ?
      menuSession(ownMenu(this.#state.canShare), (action) => (action === "share" ?
        actions.shareOwnSet() :
        actions.newClip(null))) :
      menuSession(SHARED_MENU, (action, point) => (action === "new-set" ?
        actions.newSet() :
        actions.linkSet(point)));
  }

  keySelected(): void {
    const workspace = this.#connection.current;
    if (workspace !== null) {
      keySelectedBlock(workspace);
    }
  }

  async deleteFocused(): Promise<void> {
    const focused = this.#state.clip;
    if (focused !== null) {
      await this.#actions?.deleteClip({ setId: focused.setId, clipId: focused.clip.id });
    }
  }

  renameFocused(
    name: string
  ): void {
    const row = asClipRow(this.#findRow(this.#state.selectedId ?? undefined));
    if (row !== null && this.#actions !== null) {
      this.#report(this.#actions.renameClip(row, name));
    }
  }

  changeClip(
    patch: AnimationClipPatchJSON
  ): void {
    const focused = this.#state.clip;
    if (focused !== null) {
      this.#connection.current?.animations.set(focused.setId)?.document.changeClip(focused.clip.id, patch);
    }
  }

  changeFrames(
    frames: number
  ): void {
    const focused = this.#state.clip;
    if (focused !== null && Number.isInteger(frames) && frames > 0) {
      this.changeClip({ length: new FrameRate(focused.clip.fps).toTick(frames) });
    }
  }

  async #clipAction(
    actions: AnimateActions,
    action: ClipAction,
    row: ClipRow,
    rowId: string,
    point: MenuPoint
  ): Promise<void> {
    switch (action) {
      case "rename":
        this.#view.beginRename(rowId);
        break;
      case "duplicate":
        await actions.duplicate(row);
        break;
      case "copy":
        actions.chooseCopyTarget(row, point);
        break;
      case "delete":
        await actions.deleteClip(row);
        break;
    }
  }

  async #setAction(
    actions: AnimateActions,
    action: SetAction,
    setId: string
  ): Promise<void> {
    switch (action) {
      case "new-clip":
        await actions.newClip(setId);
        break;
      case "rename":
        await actions.renameSet(setId);
        break;
      case "unlink":
        actions.unlinkSet(setId);
        break;
    }
  }

  #nodesOf(
    section: AnimateSection
  ): TreeNode<RowTarget>[] {
    return section === "own" ? this.#state.ownClips : this.#state.sharedSets;
  }

  #findRow(
    rowId: string | undefined
  ): RowTarget | undefined {
    return findRow([...this.#state.ownClips, ...this.#state.sharedSets], rowId);
  }

  readonly #report = (
    error: string | null
  ): void => {
    this.#error = error;
    this.#refresh();
  };

  readonly #refresh = (): void => {
    this.#state = this.#build();
    this.#host.requestUpdate();
  };

  #build(): AnimatePanelState {
    const workspace = this.#connection.current;
    if (workspace === null) {
      return kEmptyState;
    }

    const sets = workspace.animations.sets();
    const own = sets.find((candidate) => candidate.own);
    const { setId, clipId } = workspace.animationFocus.focus;
    const set = sets.find(({ id }) => id === setId) ?? null;
    const clip = set === null || clipId === null ? undefined : set.document.set.clip(clipId);
    const focuses = workspace.presence.clipFocuses;

    return {
      ownClips: own === undefined ? [] : clipNodes(own, focuses),
      sharedSets: sets.filter((candidate) => !candidate.own).map((shared) => setNode(shared, focuses)),
      expanded: this.#expanded.ids,
      selectedId: selectedRow(set, clip),
      set,
      clip: set === null || clip === undefined ?
        null :
        {
          setId: set.id,
          clip,
          frames: new FrameRate(clip.fps).frameAt(clip.length)
        },
      canShare: own !== undefined && own.document.set.size > 0,
      error: this.#error,
      notice: workspace.clipRemoval.notice
    };
  }
}
