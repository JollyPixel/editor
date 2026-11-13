// Import Third-party Dependencies
import type { SettingsSectionName } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { DraftValue } from "../../project/ProjectDrafts.ts";

export class SettingsEditEvent<
  TName extends SettingsSectionName = SettingsSectionName
> extends Event {
  readonly section: TName;
  readonly value: DraftValue<TName>;

  constructor(
    section: TName,
    value: DraftValue<TName>
  ) {
    super("settings-edit", { bubbles: true });
    this.section = section;
    this.value = value;
  }
}

declare global {
  interface HTMLElementEventMap {
    "settings-edit": SettingsEditEvent;
  }
}
