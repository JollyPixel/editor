// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

export type TemplateStoreEvents = {
  selectionChange: (
    templateId: string | null
  ) => void;
};

export class TemplateStore extends Emitter<TemplateStoreEvents> {
  #selected: string | null = null;

  get selected(): string | null {
    return this.#selected;
  }

  set selected(
    templateId: string | null
  ) {
    if (this.#selected === templateId) {
      return;
    }

    this.#selected = templateId;
    this.emit("selectionChange", templateId);
  }

  reconcile(
    templateIds: Iterable<string>
  ): void {
    const known = new Set(templateIds);
    if (this.#selected !== null && !known.has(this.#selected)) {
      this.selected = null;
    }
  }
}
