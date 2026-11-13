// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { query } from "lit/decorators.js";
import {
  type ContextMenu,
  type JollyChangeDetail,
  type PresencePeer,
  type Tree,
  ContextMenuController,
  LazyTemplate,
  menuPointBelow,
  type MenuPoint
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/color";
import "@jolly-pixel/ui/elements/context-menu";
import "@jolly-pixel/ui/elements/separator";
import "@jolly-pixel/ui/elements/slider";
import "@jolly-pixel/ui/elements/text";
import "@jolly-pixel/ui/elements/tree";
import "@jolly-pixel/ui/elements/message";
import "@jolly-pixel/ui/elements/fields";
import {
  MaterialSurface,
  materialFieldLockPath,
  type MaterialSurfaceJSON,
  type MaterialSurfacePatchJSON,
  type ModelMaterialJSON
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { materialLibraryStyles } from "./MaterialLibrary.styles.ts";
import { presetMenuItems } from "./library/materialIcons.ts";
import { MenuActions } from "../../shared/menu/MenuActions.ts";
import type { MaterialAction } from "./library/materialMenu.ts";
import {
  MaterialLibraryController,
  type MaterialLibraryState,
  type MaterialEditing,
  type SelectedBlockState
} from "./library/MaterialLibraryController.ts";
import {
  MaterialSurfaceController,
  type MaterialSurfaceEditing
} from "./surface/MaterialSurfaceController.ts";
import type { MaterialPreset } from "./library/materialPresets.ts";
import {
  SURFACE_GROUPS,
  UNLIT_NOTE,
  sliderMax,
  type SurfaceField,
  type SurfaceGroup
} from "./surface/surfaceFields.ts";

export class MaterialLibrary extends LitElement {
  @query("jolly-tree")
  declare private tree: Tree;

  @query("jolly-context-menu")
  declare private menu: ContextMenu;

  #dialogs = new LazyTemplate(
    this,
    () => import("../../shared/dialogs/DeleteDialog.ts")
  );
  #controller = new MaterialLibraryController(this, {
    promptDelete: (context) => this.#dialogs
      .query("jolly-model-editor-delete-dialog")
      .then((dialog) => dialog.open(context)),
    beginRename: (id) => void this.#beginRename(id),
    choosePreset: (choose, point) => this.#openPresetMenu(choose, point),
    writeClipboard,
    readClipboard
  });
  #menu = new ContextMenuController(
    () => this.menu,
    (id) => this.#controller.openMenu(id)
  );
  #surface = new MaterialSurfaceController(this);

  static override styles = materialLibraryStyles;

  attach(
    editing: MaterialEditing & MaterialSurfaceEditing
  ): void {
    this.#controller.attach(editing);
    this.#surface.attach(editing);
  }

  override render(): TemplateResult {
    const controller = this.#controller;
    const { state } = controller;
    const { edited } = this.#surface;
    const { editable } = controller;

    return html`
      <div class="layout" @paste=${this.#onPaste}>
        <section class="library">
          ${this.#renderActions(state)}
          <jolly-tree
            .nodes=${state.nodes}
            .selected=${state.selectedId === null ? [] : [state.selectedId]}
            .expanded=${state.expanded}
            .acceptDrop=${controller.acceptDrop}
            ?reorderable=${editable}
            ?row-drag=${editable}
            ?renamable=${editable}
            swatch-position="start"
            @copy=${this.#onCopy}
            @jolly-select=${controller.handleSelect}
            @jolly-activate=${controller.handleActivate}
            @jolly-activate-swatch=${controller.handleActivateSwatch}
            @jolly-context-request=${this.#menu.onContextRequest}
            @jolly-toggle-expand=${controller.handleToggleExpand}
            @jolly-rename=${controller.handleRename}
            @jolly-reparent=${controller.handleReparent}
          ></jolly-tree>
          ${state.nodes.length === 0 ?
            html`<jolly-message>No materials yet.</jolly-message>` :
            nothing}
        </section>
        <section class="editor">
          <div class="scroll">
            ${edited === null ?
              html`<jolly-message>Pick a material or create one.</jolly-message>` :
              this.#renderFields(edited, state.block)}
          </div>
        </section>
      </div>
      <jolly-context-menu
        label="Material actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
      ${this.#dialogs.render(() => html`
        <jolly-model-editor-delete-dialog></jolly-model-editor-delete-dialog>
      `)}
    `;
  }

  #renderActions(
    state: MaterialLibraryState
  ): TemplateResult {
    const { editable } = this.#controller;
    const actOnEdited = editable && state.editedId !== null;

    return html`
      <div class="actions" role="toolbar" aria-label="Material tools">
        <jolly-button
          icon="plus"
          icon-only
          label="New Material"
          title="New material"
          ?disabled=${!editable}
          @click=${this.#tool(null, "new-material")}
        ></jolly-button>
        <jolly-button
          icon="duplicate"
          icon-only
          label="Duplicate"
          title="Duplicate material"
          ?disabled=${!actOnEdited}
          @click=${this.#tool(state.editedId, "duplicate")}
        ></jolly-button>
        <jolly-button
          icon="trash"
          icon-only
          label="Delete"
          title="Delete"
          ?disabled=${!actOnEdited}
          @click=${this.#tool(state.editedId, "delete")}
        ></jolly-button>
      </div>
    `;
  }

  #tool(
    id: string | null,
    action: MaterialAction
  ): (event: MouseEvent) => void {
    return (event) => {
      void this.#menu.run(id, action, menuPointBelow(event));
    };
  }

  #renderFields(
    edited: ModelMaterialJSON,
    block: SelectedBlockState | null
  ): TemplateResult {
    return html`
      ${this.#renderEditors()}
      <jolly-fields>
        <jolly-text
          label="Name"
          path=${materialFieldLockPath(edited.id, "name")}
          ?readonly=${!this.#surface.editable}
          .value=${edited.name}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => this.#controller.rename(
            edited.id,
            event.detail.value
          )}
        ></jolly-text>
      </jolly-fields>
      ${SURFACE_GROUPS.map((group) => this.#renderGroup(group, edited))}
      ${this.#renderFooter(edited, block)}
    `;
  }

  #renderGroup(
    group: SurfaceGroup,
    edited: ModelMaterialJSON
  ): TemplateResult {
    const off = group.id === "glow" && !MaterialSurface.glows(edited.surface);
    const unlit = group.id === "surface" && !this.#surface.lit;

    return html`
      <jolly-separator label=${group.label}>
        ${off ? html`<span slot="actions" class="group-state">Off</span>` : nothing}
      </jolly-separator>
      ${unlit ? html`<p class="note">${UNLIT_NOTE}</p>` : nothing}
      <jolly-fields>
        ${group.fields.map((field) => this.#renderField(field, edited))}
      </jolly-fields>
    `;
  }

  #renderEditors(): TemplateResult | typeof nothing {
    const { editors } = this.#surface;
    if (editors.length === 0) {
      return nothing;
    }

    return html`
      <div class="header">
        <span class="editors">
          ${editors.map((peer) => html`
            <span class="editor-dot" style="background: ${peer.color}"></span>
          `)}
          ${editingLabel(editors)}
        </span>
      </div>
    `;
  }

  #renderFooter(
    edited: ModelMaterialJSON,
    block: SelectedBlockState | null
  ): TemplateResult {
    if (block === null) {
      return html`
        <div class="footer">
          <jolly-button
            title="Select a block to apply this material"
            disabled
          >Apply</jolly-button>
        </div>
      `;
    }

    const applied = block.materialId === edited.id;

    return html`
      <div class="footer">
        <jolly-button
          ?disabled=${!this.#controller.editable}
          @click=${() => this.#controller.assign(applied ? null : edited.id)}
        >${applied ? `Remove from ${block.name}` : `Apply to ${block.name}`}</jolly-button>
      </div>
    `;
  }

  #renderField(
    field: SurfaceField,
    edited: ModelMaterialJSON
  ): TemplateResult {
    const { surface } = edited;
    const path = materialFieldLockPath(edited.id, field.key);
    const readOnly = !this.#surface.editable;

    return field.control === "color" ?
      html`
        <jolly-color
          label=${field.label}
          description=${field.help}
          description-display="tooltip"
          path=${path}
          ?readonly=${readOnly}
          .value=${surface[field.key]}
          @jolly-input=${this.#listen(field.key, this.#surface.preview)}
          @jolly-change=${this.#listen(field.key, this.#surface.commit)}
        ></jolly-color>
      ` :
      html`
        <jolly-slider
          label=${field.label}
          description=${field.help}
          description-display="tooltip"
          path=${path}
          min="0"
          max=${sliderMax(field)}
          step="0.01"
          ?readonly=${readOnly}
          .value=${surface[field.key]}
          @jolly-input=${this.#listen(field.key, this.#surface.preview)}
          @jolly-change=${this.#listen(field.key, this.#surface.commit)}
        ></jolly-slider>
      `;
  }

  #openPresetMenu(
    choose: (preset: MaterialPreset) => void,
    point: MenuPoint
  ): void {
    const menu = new MenuActions();
    this.#menu.open(menu.session(presetMenuItems(menu, choose)), point);
  }

  async #beginRename(
    id: string
  ): Promise<void> {
    await this.updateComplete;
    await this.tree.updateComplete;
    this.tree.beginRename(id);
  }

  #listen<TKey extends SurfaceField["key"]>(
    key: TKey,
    write: (changes: MaterialSurfacePatchJSON) => void
  ): (event: CustomEvent<JollyChangeDetail<MaterialSurfaceJSON[TKey]>>) => void {
    return (event) => write({ [key]: event.detail.value });
  }

  readonly #onCopy = (
    event: ClipboardEvent
  ): void => {
    if (isTextEntry(event)) {
      return;
    }

    const { editedId } = this.#controller.state;
    const text = editedId === null ? null : this.#controller.copy(editedId);
    if (text !== null && event.clipboardData !== null) {
      event.clipboardData.setData("text/plain", text);
      event.preventDefault();
    }
  };

  readonly #onPaste = (
    event: ClipboardEvent
  ): void => {
    if (isTextEntry(event)) {
      return;
    }

    const text = event.clipboardData?.getData("text/plain") ?? "";
    if (this.#controller.paste(text)) {
      event.preventDefault();
    }
  };
}

function editingLabel(
  editors: readonly PresencePeer[]
): string {
  const [first, second] = editors;
  if (editors.length === 1) {
    return `${first.displayName} is editing`;
  }

  return editors.length === 2 ?
    `${first.displayName} and ${second.displayName} are editing` :
    `${first.displayName} and ${editors.length - 1} others are editing`;
}

function isTextEntry(
  event: Event
): boolean {
  return event.composedPath().some(
    (target) => target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement
  );
}

async function writeClipboard(
  text: string
): Promise<void> {
  await navigator.clipboard.writeText(text).catch(() => undefined);
}

async function readClipboard(): Promise<string | null> {
  try {
    return await navigator.clipboard.readText();
  }
  catch {
    return null;
  }
}

customElements.define("jolly-model-editor-material-library", MaterialLibrary);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-editor-material-library": MaterialLibrary;
  }
}
