// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  query,
  queryAll
} from "lit/decorators.js";
import {
  type ContextMenu,
  type JollyChangeDetail,
  type JollyContextRequestDetail,
  type JollyOption,
  type JollyReparentDetail,
  type Tree,
  ContextMenuController,
  LazyTemplate,
  MenuSession,
  menuPointBelow
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/checkbox";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/folder";
import "@jolly-pixel/ui/elements/number";
import "@jolly-pixel/ui/elements/select";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/tree";

// Import Internal Dependencies
import "../../shared/actionIcons.ts";
import "./tracks/TrackBindings.ts";
import type { TrackBindings } from "./tracks/TrackBindings.ts";
import type { TrackBindingsEditing } from "./tracks/TrackBindingsController.ts";
import "./keys/KeyInspector.ts";
import type { KeyInspector } from "./keys/KeyInspector.ts";
import type { KeyInspectorEditing } from "./keys/KeyInspectorController.ts";
import {
  AnimatePanelController,
  CLIP_FRAME_RATES,
  type AnimatePanelState,
  type AnimateSection,
  type AnimateEditing,
  type FocusedClip
} from "./AnimatePanelController.ts";

// CONSTANTS
const kFpsOptions: JollyOption<number>[] = CLIP_FRAME_RATES.map((fps) => {
  return {
    value: fps,
    label: `${fps} fps`
  };
});

export type AnimatePanelEditing = AnimateEditing &
  TrackBindingsEditing &
  KeyInspectorEditing;

export class AnimatePanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .sets {
      display: flex;
      flex: 1 1 auto;
      flex-direction: column;
      min-height: 96px;
      overflow: auto;
    }

    jolly-tree {
      padding-inline: var(--jolly-space-1, 4px) 0;
    }

    jolly-tree::part(grip) {
      display: none;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding-inline: var(--jolly-space-1, 4px) 0;
    }

    .empty {
      margin: 0;
      padding: var(--jolly-space-1, 4px);
      color: var(--jolly-text-muted, inherit);
    }

    .error,
    .notice {
      margin-block: var(--jolly-space-1, 4px);
      padding-inline: var(--jolly-space-1, 4px) 0;
    }

    .error {
      color: var(--jolly-danger, inherit);
    }

    .notice {
      color: var(--jolly-text-muted, inherit);
    }
  `;

  @query("jolly-context-menu")
  declare private menu: ContextMenu;

  @query("jolly-model-editor-track-bindings")
  declare private trackBindings: TrackBindings;

  @query("jolly-model-editor-key-inspector")
  declare private keyInspector: KeyInspector;

  @queryAll("jolly-tree")
  declare private trees: NodeListOf<Tree>;

  #dialogs = new LazyTemplate(this, () => Promise.all([
    import("../../shared/dialogs/DeleteDialog.ts"),
    import("../../shared/dialogs/NameDialog.ts")
  ]));
  #controller = new AnimatePanelController(this, {
    promptName: (context) => this.#dialogs
      .query("jolly-model-editor-name-dialog")
      .then((dialog) => dialog.open(context)),
    promptDelete: (context) => this.#dialogs
      .query("jolly-model-editor-delete-dialog")
      .then((dialog) => dialog.open(context)),
    openMenu: (session, point) => this.#menu.open(session, point),
    beginRename: (rowId) => [...this.trees].some((tree) => tree.beginRename(rowId))
  });
  #menu = new ContextMenuController(
    () => this.menu,
    () => MenuSession.EMPTY
  );
  #acceptOwnDrop = this.#controller.acceptDrop("own");
  #acceptSharedDrop = this.#controller.acceptDrop("shared");

  attach(
    editing: AnimatePanelEditing
  ): void {
    this.#controller.attach(editing);
    void this.updateComplete.then(() => {
      this.trackBindings.attach(editing);
      this.keyInspector.attach(editing);
    });
  }

  override render(): TemplateResult {
    const { state } = this.#controller;

    return html`
      ${state.error === null ? nothing : html`<p class="error" role="alert">${state.error}</p>`}
      ${state.notice === null ? nothing : html`<p class="notice" role="status">${state.notice}</p>`}
      <div class="sets">
        <jolly-folder
          flush
          role="region"
          aria-label="Animations"
          key="animations"
          label="Animations"
          storage-key="voxel-model:folder:animations"
        >
          <jolly-button
            slot="actions"
            icon="plus"
            icon-only
            label="New clip"
            title="New clip in this model"
            ?disabled=${!state.editable}
            @click=${() => void this.#controller.actions?.newClip(null)}
          ></jolly-button>
          <jolly-button
            slot="actions"
            icon="more"
            icon-only
            label="Animations options"
            title="More"
            @click=${(event: MouseEvent) => this.#openMenuBelow(event, "own")}
          ></jolly-button>
          ${state.ownClips.length === 0 ?
            html`<p class="empty">This model has no clip yet. Click + to add one, like Idle or Walk.</p>` :
            this.#renderTree("own", state.ownClips, state)}
        </jolly-folder>
        <jolly-folder
          flush
          role="region"
          aria-label="Shared sets"
          key="shared-sets"
          label="Shared sets"
          storage-key="voxel-model:folder:shared-sets"
        >
          <jolly-button
            slot="actions"
            icon="plus"
            icon-only
            label="New clip in a set"
            title="New clip in a shared set"
            ?disabled=${!state.editable || state.sharedSets.length === 0}
            @click=${this.#onNewSharedClip}
          ></jolly-button>
          <jolly-button
            slot="actions"
            label="New set"
            title="New shared set"
            ?disabled=${!state.editable}
            @click=${() => void this.#controller.actions?.newSet()}
          >New</jolly-button>
          <jolly-button
            slot="actions"
            label="Link set"
            title="Link a set another model uses"
            ?disabled=${!state.editable}
            @click=${this.#onLinkSet}
          >Link…</jolly-button>
          <jolly-button
            slot="actions"
            label="Import set"
            title="Import a set from a .zip archive or a set file"
            ?disabled=${!state.editable || !state.canImport}
            @click=${() => void this.#controller.actions?.importSet()}
          >Import…</jolly-button>
          ${state.sharedSets.length === 0 ?
            html`<p class="empty">Shared sets reuse clips across models with the same block names.</p>` :
            this.#renderTree("shared", state.sharedSets, state)}
        </jolly-folder>
      </div>
      ${state.clip === null ? nothing : this.#renderClip(state.clip, state.editable)}
      <jolly-model-editor-track-bindings></jolly-model-editor-track-bindings>
      <jolly-model-editor-key-inspector></jolly-model-editor-key-inspector>
      <jolly-context-menu
        label="Animation actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
      ${this.#dialogs.render(() => html`
        <jolly-model-editor-name-dialog></jolly-model-editor-name-dialog>
        <jolly-model-editor-delete-dialog></jolly-model-editor-delete-dialog>
      `)}
    `;
  }

  #renderTree(
    section: AnimateSection,
    nodes: AnimatePanelState["ownClips"],
    state: AnimatePanelState
  ): TemplateResult {
    return html`
      <jolly-tree
        .nodes=${nodes}
        .selected=${state.selectedId === null ? [] : [state.selectedId]}
        .expanded=${state.expanded}
        .validateRename=${this.#controller.validateRename}
        .acceptDrop=${section === "own" ? this.#acceptOwnDrop : this.#acceptSharedDrop}
        ?reorderable=${state.editable}
        ?row-drag=${state.editable}
        ?renamable=${state.editable}
        @jolly-select=${this.#controller.handleSelect}
        @jolly-toggle-expand=${this.#controller.handleToggleExpand}
        @jolly-rename=${this.#controller.handleRename}
        @jolly-reparent=${(event: CustomEvent<JollyReparentDetail>) => {
          this.#controller.handleReparent(section, event);
        }}
        @jolly-context-request=${(event: CustomEvent<JollyContextRequestDetail>) => {
          const { id, x, y } = event.detail;
          const session = id === null ?
            this.#controller.sectionMenu(section) :
            this.#controller.rowMenu(id);
          this.#menu.open(session, { x, y });
        }}
        @keydown=${this.#onTreeKeyDown}
      ></jolly-tree>
    `;
  }

  #renderClip(
    focused: FocusedClip,
    editable: boolean
  ): TemplateResult {
    const { clip, frames } = focused;

    return html`
      <jolly-folder
        flush
        role="region"
        aria-label="Clip"
        key="clip"
        label="Clip"
        storage-key="voxel-model:folder:clip"
      >
        <div class="fields">
          <jolly-text
            label="Name"
            ?readonly=${!editable}
            .value=${clip.name}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => {
              this.#controller.renameFocused(event.detail.value);
            }}
          ></jolly-text>
          <jolly-number
            label="Length (frames)"
            min="1"
            step="1"
            ?readonly=${!editable}
            .value=${frames}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              this.#controller.changeFrames(Math.round(event.detail.value));
            }}
          ></jolly-number>
          <jolly-select
            label="Frame rate"
            .options=${kFpsOptions}
            ?readonly=${!editable}
            .value=${clip.fps}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
              this.#controller.changeClip({ fps: event.detail.value });
            }}
          ></jolly-select>
          <jolly-checkbox
            label="Loop"
            ?readonly=${!editable}
            .value=${clip.loop}
            @jolly-change=${(event: CustomEvent<JollyChangeDetail<boolean>>) => {
              this.#controller.changeClip({ loop: event.detail.value });
            }}
          ></jolly-checkbox>
        </div>
      </jolly-folder>
    `;
  }

  readonly #onLinkSet = (
    event: MouseEvent
  ): void => {
    this.#controller.actions?.linkSet(menuPointBelow(event));
  };

  readonly #onNewSharedClip = (
    event: MouseEvent
  ): void => {
    this.#controller.actions?.newSharedClip(menuPointBelow(event));
  };

  readonly #onTreeKeyDown = (
    event: KeyboardEvent
  ): void => {
    const isRenaming = event.composedPath()[0] instanceof HTMLInputElement;
    if (event.key === "Delete" && !isRenaming) {
      event.preventDefault();
      void this.#controller.deleteFocused();
    }
  };

  #openMenuBelow(
    event: MouseEvent,
    section: AnimateSection
  ): void {
    this.#menu.open(this.#controller.sectionMenu(section), menuPointBelow(event));
  }
}

customElements.define("jolly-model-editor-animate-panel", AnimatePanel);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-animate-panel": AnimatePanel;
  }
}
