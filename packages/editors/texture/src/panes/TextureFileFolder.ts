// Import Third-party Dependencies
import {
  LitElement,
  css,
  html,
  type TemplateResult
} from "lit";
import {
  SubscriptionController,
  type Notifier
} from "@jolly-pixel/ui";
import "@jolly-pixel/ui/elements/button";
import "@jolly-pixel/ui/elements/folder";
import { errorMessage } from "@jolly-pixel/utils";
import { saveFile } from "@jolly-pixel/utils/dom";

// Import Internal Dependencies
import "../icons.ts";
import type { TextureFile } from "../file/TextureFile.ts";

export class TextureFileFolder extends LitElement {
  #file = new SubscriptionController<TextureFile>(this, (file) => [
    file.subscribe(() => this.requestUpdate())
  ]);
  #replacing = false;
  #notifications: Notifier | null = null;

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
  `;

  attach(
    file: TextureFile,
    notifications: Notifier
  ): void {
    this.#notifications = notifications;
    this.#file.attach(file);
  }

  override render(): TemplateResult {
    const file = this.#file.current;

    return html`
      <jolly-folder
        key="file"
        label="File"
        storage-key="texture:folder:file"
        flush
      >
        <div class="actions">
          <jolly-button
            data-tool="replace"
            icon="texture-import"
            title="Replace with another file of the same format"
            ?disabled=${file === null || this.#replacing}
            @click=${() => this.#pick()}
          >Replace…</jolly-button>
          <jolly-button
            data-tool="export"
            icon="texture-export"
            title="Download the image file"
            ?disabled=${file === null || file.bytes === null}
            @click=${() => this.#export()}
          >Export</jolly-button>
        </div>
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
    const notifications = this.#notifications;
    if (file === null || notifications === null) {
      return;
    }

    this.#replacing = true;
    this.requestUpdate();
    const replacing = notifications.notify({
      tone: "loading",
      title: `Replacing with "${selected.name}"`
    });
    try {
      const replaced = await file.replace(selected);
      replacing.update(replaced ?
        {
          tone: "success",
          title: `Replaced with "${selected.name}"`
        } :
        {
          tone: "info",
          title: `"${selected.name}" is already this image`
        });
    }
    catch (error) {
      replacing.update({
        tone: "error",
        title: `Could not replace with "${selected.name}"`,
        message: errorMessage(error)
      });
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
}

customElements.define("jolly-texture-file", TextureFileFolder);

declare global {
  interface HTMLElementTagNameMap {
    "jolly-texture-file": TextureFileFolder;
  }
}
