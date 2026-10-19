// Import Third-party Dependencies
import type { EditorConsole } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { SettingsSections } from "./SettingsSections.ts";

// CONSTANTS
export const SETTINGS_NAMESPACE = "settings";

type Commands = EditorConsole["commands"];
type Namespace = ReturnType<Commands["registerNamespace"]>;

export interface SettingsOpener {
  openSettings(
    section?: string
  ): void;
}

export function settingsConsole(
  commands: Commands,
  opener: SettingsOpener,
  sections: SettingsSections
): Namespace {
  const namespace = commands.registerNamespace(SETTINGS_NAMESPACE, {
    description: "The studio's Settings tab"
  });

  namespace.registerCommand("open", {
    description: "Open the Settings tab, on a section when one is given",
    args: [
      {
        name: "section",
        type: "enum",
        enumValues: sections.ids
      }
    ],
    execute: ({ section }) => {
      opener.openSettings(section);
    }
  });

  return namespace;
}
