// CONSTANTS
export const SETTINGS_OPEN = "settings-open";

export class SettingsOpenEvent extends Event {
  readonly section: string | undefined;

  constructor(
    section?: string
  ) {
    super(SETTINGS_OPEN, {
      bubbles: true,
      composed: true
    });
    this.section = section;
  }
}

declare global {
  interface HTMLElementEventMap {
    "settings-open": SettingsOpenEvent;
  }
}
