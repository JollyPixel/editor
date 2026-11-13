// Import Internal Dependencies
import type { AccessDraft } from "../../../project/AccessDraft.ts";

export class AccessDraftEvent extends Event {
  readonly draft: AccessDraft;

  constructor(
    draft: AccessDraft
  ) {
    super("access-draft", { bubbles: true });
    this.draft = draft;
  }
}

declare global {
  interface HTMLElementEventMap {
    "access-draft": AccessDraftEvent;
  }
}
