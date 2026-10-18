// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { TemplateDraftId } from "../document/TemplateDraftId.ts";

export type EditContextEvents = {
  change: (
    draft: TemplateDraftId | null
  ) => void;
};

export class EditContext extends Emitter<EditContextEvents> {
  #draft: TemplateDraftId | null = null;

  get draft(): TemplateDraftId | null {
    return this.#draft;
  }

  set draft(
    next: TemplateDraftId | null
  ) {
    if (this.#draft?.templateId === next?.templateId) {
      return;
    }

    this.#draft = next;
    this.emit("change", next);
  }
}
