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
import type {
  ContextMenu,
  JollyChangeDetail,
  JollyContextRequestDetail,
  JollyOption,
  JollyReparentDetail,
  Tree
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import "../../shared/actionIcons.ts";
import "./animateIcons.ts";
import "../../shared/dialogs/DeleteDialog.ts";
import "../../shared/dialogs/NameDialog.ts";
import type { DeleteDialog } from "../../shared/dialogs/DeleteDialog.ts";
import type { NameDialog } from "../../shared/dialogs/NameDialog.ts";
import { ContextMenuController } from "../../shared/menu/ContextMenuController.ts";
import { MenuSession } from "../../shared/menu/MenuSession.ts";
import { menuPointBelow } from "../../shared/menu/menuPointBelow.ts";
import "../transform/TransformPanel.ts";
import "./tracks/TrackBindings.ts";
import type { TrackBindings } from "./tracks/TrackBindings.ts";
import type { TrackBindingsWorkspace } from "./tracks/TrackBindingsController.ts";
import "./keys/KeyInspector.ts";
import type { KeyInspector } from "./keys/KeyInspector.ts";
import type { KeyInspectorWorkspace } from "./keys/KeyInspectorController.ts";
import "./timeline/timelineIcons.ts";
import type { TransformPanel } from "../transform/TransformPanel.ts";
import type { TransformWorkspace } from "../transform/TransformPanelController.ts";
import { keyBlockShortcutLabel } from "./keys/animationShortcuts.ts";
import {
  AnimatePanelController,
  CLIP_FRAME_RATES,
  type AnimatePanelState,
  type AnimateSection,
  type AnimateWorkspace,
  type FocusedClip
} from "./AnimatePanelController.ts";

// CONSTANTS
const kFpsOptions: JollyOption<number>[] = CLIP_FRAME_RATES.map((fps) => {
  return {
    value: fps,
    label: `${fps} fps`
  };
});

export type AnimatePanelWorkspace = AnimateWorkspace &
  TransformWorkspace &
  TrackBindingsWorkspace &
  KeyInspectorWorkspace;

export class AnimatePanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    .sets {
      flex: 1 1 auto;
      min-height: 96px;
      overflow: auto;
      border-bottom: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
    }

    jolly-tree {
      padding-inline: var(--jolly-space-1, 4px);
    }

    jolly-tree::part(grip) {
      display: none;
    }

    section + section {
      border-top: 1px solid var(--jolly-border, rgb(128 128 128 / 30%));
    }

    .heading {
      display: flex;
      align-items: center;
      gap: var(--jolly-space-1, 4px);
      margin: 0;
      padding: var(--jolly-space-2, 8px) var(--jolly-space-2, 8px) var(--jolly-space-1, 4px);
      font-size: inherit;
      font-weight: 600;
    }

    .heading h3 {
      flex: 1 1 auto;
      margin: 0;
      font-size: inherit;
    }

    .clip,
    .transform {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
      padding: var(--jolly-space-2, 8px);
    }

    .empty {
      padding: var(--jolly-space-2, 8px);
      color: var(--jolly-text-muted, inherit);
    }

    .error {
      padding: 0 var(--jolly-space-2, 8px);
      color: var(--jolly-danger, inherit);
    }

    .notice {
      padding: 0 var(--jolly-space-2, 8px);
      color: var(--jolly-text-muted, inherit);
    }
  `;

  @query("jolly-context-menu")
  declare private menu: ContextMenu;

  @query("jolly-model-editor-name-dialog")
  declare private nameDialog: NameDialog;

  @query("jolly-model-editor-delete-dialog")
  declare private deleteDialog: DeleteDialog;

  @query("jolly-model-editor-transform")
  declare private transformElement: TransformPanel;

  @query("jolly-model-editor-track-bindings")
  declare private trackBindings: TrackBindings;

  @query("jolly-model-editor-key-inspector")
  declare private keyInspector: KeyInspector;

  @queryAll("jolly-tree")
  declare private trees: NodeListOf<Tree>;

  #controller = new AnimatePanelController(this, {
    promptName: (context) => this.nameDialog.open(context),
    promptDelete: (context) => this.deleteDialog.open(context),
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
    workspace: AnimatePanelWorkspace
  ): void {
    this.#controller.attach(workspace);
    void this.updateComplete.then(() => {
      this.transformElement.attach(workspace);
      this.trackBindings.attach(workspace);
      this.keyInspector.attach(workspace);
    });
  }

  override render(): TemplateResult {
    const { state } = this.#controller;

    return html`
      ${state.error === null ? nothing : html`<p class="error" role="alert">${state.error}</p>`}
      ${state.notice === null ? nothing : html`<p class="notice" role="status">${state.notice}</p>`}
      <div class="sets">
        <section aria-label="Animations">
          <div class="heading">
            <h3>Animations</h3>
            <jolly-button
              icon="plus"
              icon-only
              label="New clip"
              title="New clip in this model"
              @click=${() => void this.#controller.actions?.newClip(null)}
            ></jolly-button>
            <jolly-button
              icon="options"
              icon-only
              label="Animations options"
              title="More"
              @click=${(event: MouseEvent) => this.#openMenuBelow(event, "own")}
            ></jolly-button>
          </div>
          ${state.ownClips.length === 0 ?
            html`<p class="empty">This model has no clip yet. Click + to add one, like Idle or Walk.</p>` :
            this.#renderTree("own", state.ownClips, state)}
        </section>
        <section aria-label="Shared sets">
          <div class="heading">
            <h3>Shared sets</h3>
            <jolly-button
              icon="plus"
              icon-only
              label="New clip in a set"
              title="New clip in a shared set"
              ?disabled=${state.sharedSets.length === 0}
              @click=${this.#onNewSharedClip}
            ></jolly-button>
            <jolly-button
              label="New set"
              title="New shared set"
              @click=${() => void this.#controller.actions?.newSet()}
            >New</jolly-button>
            <jolly-button
              label="Link set"
              title="Link a set another model uses"
              @click=${this.#onLinkSet}
            >Link…</jolly-button>
          </div>
          ${state.sharedSets.length === 0 ?
            html`<p class="empty">Shared sets reuse clips across models with the same block names.</p>` :
            this.#renderTree("shared", state.sharedSets, state)}
        </section>
      </div>
      ${state.clip === null ? nothing : this.#renderClip(state.clip)}
      <jolly-model-editor-track-bindings></jolly-model-editor-track-bindings>
      <jolly-model-editor-key-inspector></jolly-model-editor-key-inspector>
      ${this.#renderTransform(state)}
      <jolly-context-menu
        label="Animation actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
      <jolly-model-editor-name-dialog></jolly-model-editor-name-dialog>
      <jolly-model-editor-delete-dialog></jolly-model-editor-delete-dialog>
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
        reorderable
        row-drag
        renamable
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
    focused: FocusedClip
  ): TemplateResult {
    const { clip, frames } = focused;

    return html`
      <section class="clip" aria-label="Clip">
        <jolly-text
          label="Name"
          .value=${clip.name}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => {
            this.#controller.renameFocused(event.detail.value);
          }}
        ></jolly-text>
        <jolly-number
          label="Length (frames)"
          min="1"
          step="1"
          .value=${frames}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
            this.#controller.changeFrames(Math.round(event.detail.value));
          }}
        ></jolly-number>
        <jolly-select
          label="Frame rate"
          .options=${kFpsOptions}
          .value=${clip.fps}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<number>>) => {
            this.#controller.changeClip({ fps: event.detail.value });
          }}
        ></jolly-select>
        <jolly-checkbox
          label="Loop"
          .value=${clip.loop}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<boolean>>) => {
            this.#controller.changeClip({ loop: event.detail.value });
          }}
        ></jolly-checkbox>
      </section>
    `;
  }

  #renderTransform(
    state: AnimatePanelState
  ): TemplateResult {
    const keyLabel = `Key selected block (${keyBlockShortcutLabel()})`;

    return html`
      <section class="transform" aria-label="Transform">
        <jolly-model-editor-transform></jolly-model-editor-transform>
        <jolly-button
          icon="timeline-key"
          label="Key"
          title=${keyLabel}
          ?disabled=${state.clip === null}
          @click=${() => this.#controller.keySelected()}
        >Key</jolly-button>
      </section>
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
