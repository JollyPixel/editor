// Import Third-party Dependencies
import {
  LitElement,
  html,
  nothing,
  type TemplateResult
} from "lit";
import {
  query,
  state
} from "lit/decorators.js";
import {
  LocalStorageAdapter,
  type ContextMenu,
  type JollyChangeDetail,
  type PresencePeer,
  type Tree
} from "@jolly-pixel/ui";
import type {
  MaterialSurfaceJSON,
  MaterialSurfacePatchJSON,
  ModelMaterialJSON
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import { materialLibraryStyles } from "./MaterialLibrary.styles.ts";
import { presetIcon } from "./library/materialIcons.ts";
import "../../shared/actionIcons.ts";
import "../../shared/DeleteDialog.ts";
import type { DeleteDialog } from "../../shared/DeleteDialog.ts";
import { ContextMenuController } from "../../shared/ContextMenuController.ts";
import {
  menuSession,
  type MenuPoint
} from "../../shared/menuSession.ts";
import type { MaterialAction } from "./library/materialMenu.ts";
import {
  MaterialLibraryController,
  type MaterialLibraryState,
  type MaterialWorkspace,
  type SelectedBlockState
} from "./library/MaterialLibraryController.ts";
import {
  MaterialSurfaceController,
  type MaterialSurfaceWorkspace
} from "./surface/MaterialSurfaceController.ts";
import {
  MATERIAL_PRESETS,
  type MaterialPreset
} from "./library/materialPresets.ts";
import {
  MATERIAL_HELP,
  SURFACE_GROUPS,
  UNLIT_NOTE,
  sliderMax,
  type SurfaceField,
  type SurfaceGroup
} from "./surface/surfaceFields.ts";
import { surfaceGlows } from "../../shared/materialSwatch.ts";

// CONSTANTS
const kHelpKey = "voxel-model:material-help";

export class MaterialLibrary extends LitElement {
  @state()
  declare private help: boolean;

  @query("jolly-tree")
  declare private tree: Tree;

  @query("jolly-context-menu")
  declare private menu: ContextMenu;

  @query("jolly-model-editor-delete-dialog")
  declare private deleteDialog: DeleteDialog;

  #controller = new MaterialLibraryController(this, {
    promptDelete: (context) => this.deleteDialog.open(context),
    beginRename: (id) => void this.#beginRename(id),
    choosePreset: (choose, point) => this.#openPresetMenu(choose, point),
    writeClipboard,
    readClipboard
  });
  #menu = new ContextMenuController(
    () => this.menu,
    (id) => this.#controller.menuFor(id)
  );
  #surface = new MaterialSurfaceController(this);
  #preferences = new LocalStorageAdapter();

  static override styles = materialLibraryStyles;

  constructor() {
    super();
    this.help = this.#preferences.get(kHelpKey) === "on";
  }

  attach(
    workspace: MaterialWorkspace & MaterialSurfaceWorkspace
  ): void {
    this.#controller.attach(workspace);
    this.#surface.attach(workspace);
  }

  override render(): TemplateResult {
    const controller = this.#controller;
    const { state } = controller;
    const { edited } = this.#surface;

    return html`
      <div class="layout" @paste=${this.#onPaste}>
        <section class="library">
          ${this.#renderActions(state)}
          <jolly-tree
            .nodes=${state.nodes}
            .selected=${state.selectedId === null ? [] : [state.selectedId]}
            .expanded=${state.expanded}
            .acceptDrop=${controller.acceptDrop}
            reorderable
            row-drag
            renamable
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
            html`<p class="empty">No materials yet.</p>` :
            nothing}
        </section>
        <section class="editor">
          <div class="scroll">
            ${edited === null ?
              html`<p class="empty">Pick a material or create one.</p>` :
              this.#renderFields(edited, state.block)}
          </div>
        </section>
      </div>
      <jolly-context-menu
        label="Material actions"
        @jolly-context-action=${this.#menu.onContextAction}
      ></jolly-context-menu>
      <jolly-model-editor-delete-dialog></jolly-model-editor-delete-dialog>
    `;
  }

  #renderActions(
    state: MaterialLibraryState
  ): TemplateResult {
    return html`
      <div class="actions" role="toolbar" aria-label="Material tools">
        <jolly-button
          icon="plus"
          icon-only
          label="New Material"
          title="New material"
          @click=${this.#tool(null, "new-material")}
        ></jolly-button>
        <jolly-button
          icon="action-duplicate"
          icon-only
          label="Duplicate"
          title="Duplicate material"
          ?disabled=${state.editedId === null}
          @click=${this.#tool(state.editedId, "duplicate")}
        ></jolly-button>
        <jolly-button
          icon="action-delete"
          icon-only
          label="Delete"
          title="Delete"
          ?disabled=${state.editedId === null}
          @click=${this.#tool(state.editedId, "delete")}
        ></jolly-button>
        <jolly-button
          class="help-toggle"
          icon="info"
          icon-only
          label="Help"
          title=${this.help ? "Hide help" : "Show help"}
          aria-pressed=${this.help ? "true" : "false"}
          @click=${this.#toggleHelp}
        ></jolly-button>
      </div>
    `;
  }

  #tool(
    id: string | null,
    action: MaterialAction
  ): (event: MouseEvent) => void {
    return (event) => {
      const button = event.currentTarget;
      if (!(button instanceof HTMLElement)) {
        return;
      }

      const anchor = button.getBoundingClientRect();
      void this.#menu.run(id, action, {
        x: anchor.left,
        y: anchor.bottom
      });
    };
  }

  #renderFields(
    edited: ModelMaterialJSON,
    block: SelectedBlockState | null
  ): TemplateResult {
    return html`
      ${this.#renderEditors()}
      ${this.help ? html`<p class="help">${MATERIAL_HELP}</p>` : nothing}
      <div class="fields">
        <jolly-text
          label="Name"
          path=${fieldPath(edited.id, "name")}
          .value=${edited.name}
          @jolly-change=${(event: CustomEvent<JollyChangeDetail<string>>) => this.#controller.rename(
            edited.id,
            event.detail.value
          )}
        ></jolly-text>
      </div>
      ${SURFACE_GROUPS.map((group) => this.#renderGroup(group, edited))}
      ${this.#renderFooter(edited, block)}
    `;
  }

  #renderGroup(
    group: SurfaceGroup,
    edited: ModelMaterialJSON
  ): TemplateResult {
    const off = group.id === "glow" && !surfaceGlows(edited.surface);
    const unlit = group.id === "surface" && !this.#surface.lit;

    return html`
      <jolly-folder label=${group.label} .collapsible=${false}>
        ${off ? html`<span slot="actions" class="group-state">Off</span>` : nothing}
        ${unlit ? html`<p class="note">${UNLIT_NOTE}</p>` : nothing}
        <div class="fields">
          ${group.fields.map((field) => this.#renderField(field, edited))}
        </div>
      </jolly-folder>
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
    const description = this.help ? field.help : "";
    const path = fieldPath(edited.id, field.key);

    return field.control === "color" ?
      html`
        <jolly-color
          label=${field.label}
          description=${description}
          path=${path}
          .value=${surface[field.key]}
          @jolly-input=${this.#listen(field.key, this.#surface.preview)}
          @jolly-change=${this.#listen(field.key, this.#surface.commit)}
        ></jolly-color>
      ` :
      html`
        <jolly-slider
          label=${field.label}
          description=${description}
          path=${path}
          min="0"
          max=${sliderMax(field)}
          step="0.01"
          .value=${surface[field.key]}
          @jolly-input=${this.#listen(field.key, this.#surface.preview)}
          @jolly-change=${this.#listen(field.key, this.#surface.commit)}
        ></jolly-slider>
      `;
  }

  #toggleHelp(): void {
    this.help = !this.help;
    this.#preferences.set(kHelpKey, this.help ? "on" : "off");
  }

  #openPresetMenu(
    choose: (preset: MaterialPreset) => void,
    point: MenuPoint
  ): void {
    const presets = new Map(MATERIAL_PRESETS.map((preset) => [preset.id, preset]));
    const items = MATERIAL_PRESETS.map((preset) => {
      return {
        id: preset.id,
        label: preset.label,
        icon: presetIcon(preset)
      };
    });

    this.#menu.open(
      menuSession(items, (presetId) => {
        const preset = presets.get(presetId);
        if (preset !== undefined) {
          choose(preset);
        }
      }),
      point
    );
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

function fieldPath(
  materialId: string,
  field: SurfaceField["key"] | "name"
): string {
  return `material:${materialId}:${field}`;
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
