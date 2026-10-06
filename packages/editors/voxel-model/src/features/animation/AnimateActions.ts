// Import Internal Dependencies
import type {
  AnimationLibrary,
  ClipRef,
  ClipTarget
} from "./AnimationLibrary.ts";
import type { ClipRow } from "./animateRows.ts";
import type { AnimationFocusStore } from "../../state/index.ts";
import type {
  NameDialogContext,
  NameDialogResult
} from "../../shared/NameDialog.ts";
import type { NameValidator } from "../../shared/NameDraft.ts";
import type {
  DeleteContext,
  DeleteResult
} from "../../shared/DeleteDialog.ts";
import {
  pickerMenu,
  type MenuPoint,
  type MenuSession
} from "../../shared/menuSession.ts";
import { duplicateNameOf } from "../../model/index.ts";

// CONSTANTS
const kFirstClipName = "Clip 1";

export interface AnimateActionsWorkspace {
  animations: AnimationLibrary;
  animationFocus: AnimationFocusStore;
}

export interface AnimateActionsView {
  promptName(
    context: NameDialogContext
  ): Promise<NameDialogResult | null>;
  promptDelete(
    context: DeleteContext
  ): Promise<DeleteResult | null>;
  openMenu(
    session: MenuSession,
    point: MenuPoint
  ): void;
}

export interface AnimateActionsOptions {
  workspace: AnimateActionsWorkspace;
  view: AnimateActionsView;
  expand(setId: string): void;
  /** Why the last action failed, or `null` once one succeeds. */
  report(error: string | null): void;
}

export class AnimateActions {
  #workspace: AnimateActionsWorkspace;
  #view: AnimateActionsView;
  #expand: (setId: string) => void;
  #report: (error: string | null) => void;

  constructor(
    options: AnimateActionsOptions
  ) {
    this.#workspace = options.workspace;
    this.#view = options.view;
    this.#expand = options.expand;
    this.#report = options.report;
  }

  get #animations(): AnimationLibrary {
    return this.#workspace.animations;
  }

  async newClip(
    target: ClipTarget
  ): Promise<void> {
    const animations = this.#animations;
    const result = await this.#view.promptName({
      heading: target === null ? "New Clip" : `New Clip in ${animations.targetName(target)}`,
      fieldLabel: "Clip name",
      defaultName: animations.freeClipName(target, kFirstClipName),
      validate: this.nameRule(target)
    });
    if (result !== null) {
      this.#focusClip(await this.#attempt(
        `Could not add "${result.name}"`,
        () => animations.addClip(target, result.name)
      ));
    }
  }

  newSharedClip(
    point: MenuPoint
  ): void {
    const options = this.#sharedSetIds().map((id) => {
      return {
        label: `In ${this.#animations.targetName(id)}`,
        value: id
      };
    });

    this.#view.openMenu(
      pickerMenu(options, "Create or link a set first", (id) => this.newClip(id)),
      point
    );
  }

  async newSet(): Promise<void> {
    const result = await this.#view.promptName({
      heading: "New Animation Set",
      fieldLabel: "Set name",
      defaultName: "Animation set"
    });
    if (result === null) {
      return;
    }

    const id = await this.#attempt(
      `Could not create "${result.name}"`,
      () => this.#animations.create(result.name)
    );
    if (id !== null) {
      this.#focusSet(id);
    }
  }

  async shareOwnSet(): Promise<void> {
    const own = this.#animations.ownSet();
    if (own === undefined) {
      return;
    }

    const result = await this.#view.promptName({
      heading: "Share as Set",
      fieldLabel: "Set name",
      defaultName: own.name
    });
    if (result === null) {
      return;
    }

    const shared = await this.#attempt(
      `Could not share as "${result.name}"`,
      () => this.#animations.share(own.id, result.name)
    );
    if (shared !== null) {
      this.#expand(shared);
    }
  }

  linkSet(
    point: MenuPoint
  ): void {
    const options = this.#animations.linkable().map((record) => {
      return {
        label: record.name,
        value: record.id
      };
    });

    this.#view.openMenu(pickerMenu(options, "No other animation set", (id) => {
      if (this.#animations.link(id)) {
        this.#focusSet(id);
      }
    }), point);
  }

  async renameSet(
    setId: string
  ): Promise<void> {
    const name = this.#animations.targetName(setId);
    const result = await this.#view.promptName({
      heading: "Rename Set",
      fieldLabel: "Set name",
      defaultName: name
    });
    if (result !== null && result.name !== name) {
      await this.#attempt(
        `Could not rename "${name}"`,
        () => this.#animations.renameSet(setId, result.name)
      );
    }
  }

  unlinkSet(
    setId: string
  ): void {
    const { animationFocus } = this.#workspace;
    this.#animations.unlink(setId);
    if (animationFocus.focus.setId === setId) {
      animationFocus.focusSet(null);
    }
  }

  renameClip(
    row: ClipRow,
    name: string
  ): string | null {
    const trimmed = name.trim();
    const document = this.#animations.set(row.setId)?.document;
    if (document === undefined || trimmed === "" || trimmed === document.set.clip(row.clipId)?.name) {
      return null;
    }

    const error = this.nameRule(row.target, row.clipId)(trimmed);
    if (error === null) {
      document.changeClip(row.clipId, { name: trimmed });
    }

    return error;
  }

  async duplicate(
    row: ClipRow
  ): Promise<void> {
    const document = this.#animations.set(row.setId)?.document;
    const clip = document?.set.clip(row.clipId);
    if (document === undefined || clip === undefined) {
      return;
    }

    const beforeId = document.set.nextClipOf(row.clipId);
    this.#focusClip(await this.#attempt(
      `Could not duplicate "${clip.name}"`,
      () => this.#animations.copyClip(row, row.target, {
        name: this.#animations.freeClipName(row.target, duplicateNameOf(clip.name)),
        ...beforeId === undefined ? {} : { beforeId }
      })
    ));
  }

  copyTargets(
    row: ClipRow
  ): ClipTarget[] {
    return [null, ...this.#sharedSetIds()].filter((target) => target !== row.target);
  }

  chooseCopyTarget(
    row: ClipRow,
    point: MenuPoint
  ): void {
    const options = this.copyTargets(row).map((target) => {
      return {
        label: target === null ? "This model" : this.#animations.targetName(target),
        value: target
      };
    });

    this.#view.openMenu(pickerMenu(options, "No other place", async(target) => {
      this.#focusClip(await this.#copy(row, target));
    }), point);
  }

  reorder(
    row: ClipRow,
    beforeId: string | undefined
  ): void {
    if (this.#animations.set(row.setId)?.document.moveClip(row.clipId, beforeId)) {
      this.#focusClip(row);
    }
  }

  async deleteClip(
    ref: ClipRef
  ): Promise<void> {
    const { animationFocus } = this.#workspace;
    const set = this.#animations.set(ref.setId);
    const clip = set?.document.set.clip(ref.clipId);
    if (set === undefined || clip === undefined) {
      return;
    }

    const confirmed = await this.#view.promptDelete({
      heading: "Delete Clip",
      hasChildren: false,
      ...set.users > 1 ?
        { message: `"${clip.name}" is deleted for the ${set.users} models using "${set.name}".` } :
        {}
    });
    if (confirmed === null) {
      return;
    }

    set.document.removeClip(clip.id);
    const { focus } = animationFocus;
    if (focus.setId === ref.setId && focus.clipId === ref.clipId) {
      animationFocus.focusSet(set.own ? null : set.id);
    }
  }

  nameRule(
    target: ClipTarget,
    exceptClipId?: string
  ): NameValidator {
    const animations = this.#animations;

    return (name) => (animations.clipNameTaken(target, name, exceptClipId) ?
      `A clip named "${name.trim()}" already exists in ${animations.targetName(target)}` :
      null);
  }

  async #copy(
    from: ClipRow,
    target: ClipTarget
  ): Promise<ClipRef | null> {
    const animations = this.#animations;
    const clip = animations.set(from.setId)?.document.set.clip(from.clipId);
    if (clip === undefined) {
      return null;
    }

    let name = clip.name;
    if (animations.clipNameTaken(target, name)) {
      const result = await this.#view.promptName({
        heading: `Copy "${clip.name}" to ${animations.targetName(target)}`,
        fieldLabel: "Clip name",
        defaultName: animations.freeClipName(target, name),
        validate: this.nameRule(target)
      });
      if (result === null) {
        return null;
      }
      name = result.name;
    }

    return this.#attempt(
      `Could not copy "${clip.name}"`,
      () => animations.copyClip(from, target, { name })
    );
  }

  #sharedSetIds(): string[] {
    return this.#animations.sets()
      .filter((set) => !set.own)
      .map((set) => set.id);
  }

  #focusSet(
    setId: string
  ): void {
    this.#expand(setId);
    this.#workspace.animationFocus.focusSet(setId);
  }

  #focusClip(
    ref: ClipRef | null
  ): void {
    if (ref !== null) {
      this.#expand(ref.setId);
      this.#workspace.animationFocus.focusClip(ref.setId, ref.clipId);
    }
  }

  async #attempt<T>(
    failure: string,
    operation: () => Promise<T>
  ): Promise<T | null> {
    try {
      const result = await operation();
      this.#report(null);

      return result;
    }
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      this.#report(`${failure}: ${reason}`);

      return null;
    }
  }
}
