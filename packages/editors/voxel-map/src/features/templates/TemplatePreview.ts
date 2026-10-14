// Import Third-party Dependencies
import { html, css, nothing } from "lit";
import {
  customElement,
  query,
  state
} from "lit/decorators.js";

// Import Internal Dependencies
import type { VoxelMapWorkspace } from "../../workspace/VoxelMapWorkspace.ts";
import { WorkspaceElement } from "../../workspace/WorkspaceElement.ts";
import { hintStyles } from "../../shared/styles/hint.styles.ts";
import { previewWellStyles } from "../../shared/styles/previewWell.styles.ts";
import { SquareTurntable } from "../preview/SquareTurntable.ts";
import { TemplatePreviewSubject } from "./rendering/TemplatePreviewSubject.ts";
import {
  resolveTemplatePreview,
  type TemplatePreviewView
} from "./TemplatePreviewView.ts";

@customElement("template-preview")
export class TemplatePreview extends WorkspaceElement {
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
        position: relative;
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

  protected override watchWorkspace(
    workspace: VoxelMapWorkspace
  ): Iterable<() => void> {
    const { mapDocument, templates } = workspace;
    const sync = (): void => {
      this._view = resolveTemplatePreview(
        mapDocument.world.templates,
        templates.store.selected
      );
    };
    sync();

    return [
      mapDocument.subscribe("templatesChanged", sync),
      mapDocument.subscribe("reset", sync),
      templates.store.subscribe("selectionChange", sync),
      mapDocument.subscribe(
        "blockRegistryChanged",
        () => this.#renderer?.subject.invalidate()
      ),
      () => this.#disposeRenderer()
    ];
  }

  override render() {
    const view = this._view;
    if (this.workspace === null || view.kind === "hidden") {
      return nothing;
    }

    return html`
      <div class="frame">
        <div class="well">
          ${view.kind === "empty" ? html`
            <p class="hint">Select a template to preview it.</p>
          ` : nothing}
        </div>
      </div>
    `;
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
    const workspace = this.attached;
    const renderer = new SquareTurntable(well, new TemplatePreviewSubject({
      sources: workspace.blockSources,
      blockRegistry: workspace.view.document.blocks
    }));
    renderer.onContextLost = () => {
      this.#disposeRenderer();
      this.requestUpdate();
    };

    return renderer;
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
