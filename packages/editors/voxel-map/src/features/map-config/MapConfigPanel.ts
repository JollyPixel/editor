// Import Third-party Dependencies
import {
  LitElement,
  html,
  css,
  nothing,
  type PropertyValues
} from "lit";
import {
  customElement,
  property,
  query,
  state
} from "lit/decorators.js";
import {
  showChoice,
  showConfirm,
  type JollyChangeDetail
} from "@jolly-pixel/ui";
import type {
  ImportConflictPolicy,
  ImportPlan
} from "@jolly-pixel/asset-server/catalog/client";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../scene/EditorScene.ts";
import type { EventInput } from "../../shared/domEvents.ts";

@customElement("map-config-panel")
export class MapConfigPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--jolly-row-gap, 4px);
    }

    input[type="file"] {
      display: none;
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: var(--jolly-row-gap, 4px);
    }

    .notice,
    .error {
      font-size: 11px;
      margin: 0;
    }

    .notice {
      color: var(--jolly-text-muted, #888);
    }

    .error {
      color: var(--jolly-danger, #e5484d);
    }
  `;

  @property({ attribute: false })
  declare workspace: VoxelMapWorkspace;

  @state()
  private declare _gridVisible: boolean;

  @state()
  private declare _flatLighting: boolean;

  @state()
  private declare _skyRadius: number;

  @state()
  private declare _busy: boolean;

  @state()
  private declare _error: string | null;

  @query("#file-input")
  declare private _fileInput: HTMLInputElement;

  constructor() {
    super();
    this._gridVisible = true;
    this._flatLighting = false;
    this._skyRadius = 0;
    this._busy = false;
    this._error = null;
  }

  override willUpdate(
    changedProperties: PropertyValues<this>
  ): void {
    if (changedProperties.has("workspace")) {
      const { gridRenderer, lighting, localBrush } = this.workspace;
      this._gridVisible = gridRenderer.visible;
      this._flatLighting = lighting.mode === "flat";
      this._skyRadius = localBrush.skyRadius;
    }
  }

  override render() {
    return html`
      <jolly-checkbox
        align="end"
        label="Grid visibility"
        .value=${this._gridVisible}
        @jolly-change=${this.#onGridVisibleChange}
      ></jolly-checkbox>

      <jolly-checkbox
        align="end"
        label="Flat lighting"
        .value=${this._flatLighting}
        @jolly-change=${this.#onFlatLightingChange}
      ></jolly-checkbox>

      <jolly-slider
        label="Sky radius"
        min="0"
        max="32"
        step="1"
        .value=${this._skyRadius}
        @jolly-input=${this.#onSkyRadiusChange}
        @jolly-change=${this.#onSkyRadiusChange}
      ></jolly-slider>

      ${this.#renderArchives()}
    `;
  }

  #renderArchives() {
    const { archives } = this.workspace;

    return html`
      <div class="actions">
        <jolly-button
          id="export-map"
          ?disabled=${this._busy}
          @click=${this.#onExport}
        >Export map (.zip)</jolly-button>
        <jolly-button
          id="import-map"
          ?disabled=${this._busy || !archives.canImport}
          @click=${this.#onImport}
        >Import (.zip)</jolly-button>
        ${archives.canReset ?
          html`
            <jolly-button
              id="reset-workspace"
              variant="danger"
              ?disabled=${this._busy}
              @click=${this.#onReset}
            >Reset workspace</jolly-button>
          ` :
          nothing}
      </div>
      ${archives.volatile ?
        html`
          <p class="notice">
            This workspace is open in another tab. Changes made here are not
            saved and importing is disabled.
          </p>
        ` :
        nothing}
      ${this._error === null ?
        nothing :
        html`<p class="error" role="alert">${this._error}</p>`}
      <input
        type="file"
        id="file-input"
        accept=".zip,application/zip"
        @change=${this.#onFileSelected}
      />
    `;
  }

  #onGridVisibleChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this._gridVisible = event.detail.value;
    this.workspace.gridRenderer.setVisible(this._gridVisible);
  }

  #onFlatLightingChange(
    event: CustomEvent<JollyChangeDetail<boolean>>
  ): void {
    this._flatLighting = event.detail.value;
    this.workspace.lighting.mode = this._flatLighting ? "flat" : "lit";
  }

  #onSkyRadiusChange(
    event: CustomEvent<JollyChangeDetail<number>>
  ): void {
    this._skyRadius = event.detail.value;
    this.workspace.localBrush.skyRadius = this._skyRadius;
  }

  async #onExport(): Promise<void> {
    await this.#run(async() => {
      const { blob, fileName } = await this.workspace.archives.export();
      const url = URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    });
  }

  #onImport(): void {
    const input = this._fileInput;
    input.value = "";
    input.click();
  }

  async #onFileSelected(
    event: EventInput
  ): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await this.#run(async() => {
      const { archives } = this.workspace;
      const plan = await archives.plan(file);
      const onConflict = plan.live.length === 0 ?
        "keep" :
        await askConflictPolicy(plan);
      if (onConflict === null) {
        return;
      }

      const report = await archives.import(file, onConflict);
      if (report.root !== undefined) {
        location.assign(
          archives.launchUrl(location.href, report.root.id)
        );
      }
    });
  }

  async #onReset(): Promise<void> {
    const confirmed = await showConfirm({
      title: "Reset workspace",
      message: "Every map and tileset stored in this browser is deleted. " +
        "Export what you want to keep first.",
      confirmLabel: "Reset",
      danger: true
    });
    if (!confirmed) {
      return;
    }

    await this.#run(async() => {
      await this.workspace.archives.reset();
      location.reload();
    });
  }

  async #run(
    task: () => Promise<void>
  ): Promise<void> {
    this._busy = true;
    this._error = null;
    try {
      await task();
    }
    catch (error) {
      this._error = error instanceof Error ? error.message : String(error);
    }
    finally {
      this._busy = false;
    }
  }
}

function askConflictPolicy(
  plan: ImportPlan
): Promise<ImportConflictPolicy | null> {
  const content: Node[] = [];
  if (plan.sharedDependents.length > 0) {
    const warning = document.createElement("p");
    warning.textContent = "Replacing also changes assets outside the archive:";

    const list = document.createElement("ul");
    for (const shared of plan.sharedDependents) {
      const item = document.createElement("li");
      const dependents = shared.dependents
        .map((dependent) => dependent.path)
        .join(", ");
      item.textContent = `${shared.path} is used by ${dependents}`;
      list.append(item);
    }
    content.push(warning, list);
  }

  return showChoice<ImportConflictPolicy>({
    title: "Import archive",
    message: `${plan.live.length} of the archived assets already exist in ` +
      "this workspace.",
    content,
    actions: [
      {
        value: "keep",
        label: "Keep mine"
      },
      {
        value: "replace",
        label: "Replace",
        variant: "danger"
      }
    ],
    focus: "keep"
  });
}

declare global {
  interface HTMLElementTagNameMap {
    "map-config-panel": MapConfigPanel;
  }
}
