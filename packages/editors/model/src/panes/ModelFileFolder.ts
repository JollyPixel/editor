// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  nothing,
  type TemplateResult
} from "lit";
import { saveFile } from "@jolly-pixel/editor.host";
import { SubscriptionController } from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/folder";

// Import Internal Dependencies
import "../icons.ts";
import type { ModelFile } from "../file/ModelFile.ts";

interface ModelFileStatus {
  readonly text: string;
  readonly failed: boolean;
}

export class ModelFileFolder extends LitElement {
  #file = new SubscriptionController<ModelFile>(this, (file) => [
    file.subscribe(() => this.requestUpdate())
  ]);
  #replacing = false;
  #status: ModelFileStatus | null = null;

  static override styles = css`
    :host {
      display: block;
      color: var(--jolly-text);
    }

    .actions {
      display: flex;
      gap: var(--jolly-space-2);
      padding: var(--jolly-space-1) var(--jolly-space-2);
    }

    .status {
      margin: 0;
      padding: 0 var(--jolly-space-2) var(--jolly-space-1);
      color: var(--jolly-text-muted);
      overflow-wrap: anywhere;
    }

    .status[data-failed] {
      color: var(--jolly-danger);
    }
  `;

  attach(
    file: ModelFile
  ): void {
    this.#file.attach(file);
  }

  override render(): TemplateResult {
    const file = this.#file.current;
    const status = this.#status;

    return html`
      <jolly-folder
        key="file"
        label="File"
        storage-key="model:folder:file"
        flush
      >
        <div class="actions">
          <jolly-button
            data-tool="replace"
            icon="model-import"
            title="Replace with another file of the same format"
            ?disabled=${file === null || this.#replacing}
            @click=${() => this.#pick()}
          >Replace…</jolly-button>
          <jolly-button
            data-tool="export"
            icon="model-export"
            title="Download the model file"
            ?disabled=${file === null || file.bytes === null}
            @click=${() => this.#export()}
          >Export</jolly-button>
        </div>
        ${status === null ? nothing : html`
          <p class="status" role="status" ?data-failed=${status.failed}>
            ${status.text}
          </p>
        `}
        <input
          type="file"
          hidden
          accept=${file?.extension ?? ""}
          @change=${this.#onFileSelected}
        >
      </jolly-folder>
    `;
  }

  #pick(): void {
    this.renderRoot.querySelector("input")?.click();
  }

  #onFileSelected = (
    event: Event
  ): void => {
    const input = event.currentTarget as HTMLInputElement;
    const selected = input.files?.[0];
    input.value = "";
    if (selected !== undefined) {
      void this.#replace(selected);
    }
  };

  async #replace(
    selected: File
  ): Promise<void> {
    const file = this.#file.current;
    if (file === null) {
      return;
    }

    this.#replacing = true;
    this.#show(`Replacing with "${selected.name}"…`);
    try {
      const replaced = await file.replace(selected);
      this.#show(replaced ?
        `Replaced with "${selected.name}".` :
        `"${selected.name}" is already this model.`);
    }
    catch (error) {
      this.#show(
        error instanceof Error ? error.message : String(error),
        true
      );
    }
    finally {
      this.#replacing = false;
      this.requestUpdate();
    }
  }

  #export(): void {
    const download = this.#file.current?.download() ?? null;
    if (download !== null) {
      saveFile(download.blob, download.name);
    }
  }

  #show(
    text: string,
    failed = false
  ): void {
    this.#status = {
      text,
      failed
    };
    this.requestUpdate();
  }
}

customElements.define("jolly-model-file", ModelFileFolder);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-model-file": ModelFileFolder;
  }
}
