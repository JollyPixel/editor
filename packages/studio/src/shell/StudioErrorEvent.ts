export interface StudioErrorDetail {
  message: string;
}

export class StudioErrorEvent extends CustomEvent<StudioErrorDetail> {
  static from(
    error: unknown,
    context?: string
  ): StudioErrorEvent {
    const reason = error instanceof Error ? error.message : String(error);

    return new StudioErrorEvent(
      context === undefined ? reason : `${context}: ${reason}`
    );
  }

  constructor(
    message: string
  ) {
    super("studio-error", {
      bubbles: true,
      composed: true,
      detail: { message }
    });
  }
}

declare global {
  interface HTMLElementEventMap {
    "studio-error": StudioErrorEvent;
  }
}
