// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import type { VoxelMapEditing } from "../../editing/VoxelMapEditing.ts";
import { EditingElement } from "../../editing/EditingElement.ts";
import { hintStyles } from "../../shared/styles/hint.styles.ts";
import { previewWellStyles } from "../../shared/styles/previewWell.styles.ts";
import { SquareTurntable } from "../preview/SquareTurntable.ts";
import { TemplatePreviewSubject } from "./rendering/TemplatePreviewSubject.ts";
import {
  resolveTemplatePreview,
  type TemplatePreviewView
} from "./TemplatePreviewView.ts";
import "./templateIcons.ts";

@customElement("template-preview")
export class TemplatePreview extends EditingElement {
  static override styles = [
    hintStyles,
    previewWellStyles,
    css`
      :host {
        display: block;
      }

      .frame {
        padding: var(--jolly-space-1, 4px);
      }

      .well {
        display: flex;
        align-items: center;
        justify-content: center;
        height: clamp(160px, 40cqh, 300px);
      }

      .hint {
        position: absolute;
        text-align: center;
      }
    `
  ];

  @state()
  private declare _view: TemplatePreviewView;

  @query(".well")
  declare private _well: HTMLDivElement | null;

  #renderer: SquareTurntable<TemplatePreviewSubject> | null = null;

  constructor() {
    super();
    this._view = { kind: "hidden" };
  }

  protected override watchEditing(
    editing: VoxelMapEditing
  ): Iterable<() => void> {
    const { editorMap, templates, state } = editing;
    const sync = (): void => {
      this._view = resolveTemplatePreview(
        editorMap.world.templates,
        templates.store.selected,
        state.templatePreview.value
      );
    };
    sync();

    return [
      editorMap.subscribe("templatesChanged", sync),
      editorMap.subscribe("reset", sync),
      templates.store.subscribe("selectionChange", sync),
      state.templatePreview.subscribe("change", sync),
      editorMap.subscribe(
        "blockRegistryChanged",
        () => this.#renderer?.subject.invalidate()
      ),
      () => this.#disposeRenderer()
    ];
  }

  override render() {
    const view = this._view;
    if (this.editing === null || view.kind === "hidden") {
      return nothing;
    }

    const enabled = view.kind !== "disabled";

    return html`
      <div class="frame">
        <div class="well">
          <button
            class="toggle"
            type="button"
            aria-label=${enabled ? "Hide preview" : "Show preview"}
            aria-pressed=${enabled ? "true" : "false"}
            @click=${this.#onToggle}
          ><jolly-icon name=${enabled ? "eye" : "eye-off"} aria-hidden="true"></jolly-icon></button>
          ${this.#renderHint(view)}
        </div>
      </div>
    `;
  }

  readonly #onToggle = (): void => {
    const store = this.attached.state.templatePreview;
    store.value = store.value === "enabled" ? "disabled" : "enabled";
  };

  #renderHint(
    view: TemplatePreviewView
  ) {
    switch (view.kind) {
      case "empty":
        return html`<p class="hint">Select a template to preview it.</p>`;
      case "disabled":
        return html`<p class="hint">Preview disabled</p>`;
      default:
        return nothing;
    }
  }

  override updated(): void {
    const view = this._view;
    if (view.kind !== "template" || this._well === null) {
      this.#disposeRenderer();

      return;
    }

    this.#renderer ??= this.#createRenderer(this._well);
    this.#renderer.subject.template = view.template;
  }

  #createRenderer(
    well: HTMLDivElement
  ): SquareTurntable<TemplatePreviewSubject> {
    const editing = this.attached;

    return new SquareTurntable(
      well,
      editing.previewStage,
      new TemplatePreviewSubject({
        sources: editing.blockSources,
        blockRegistry: editing.view.document.blocks
      })
    );
  }

  #disposeRenderer(): void {
    this.#renderer?.dispose();
    this.#renderer = null;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "template-preview": TemplatePreview;
  }
}
