// Import Third-party Dependencies
import type {
  ConsoleNamespace,
  RegistrationHandle
} from "@jolly-pixel/console";
import type { ThemeMode } from "@jolly-pixel/ui";

// CONSTANTS
export const THEME_MODES: readonly ThemeMode[] = Object.freeze([
  "light",
  "dark",
  "auto"
]);
const kScopeSelector = "jolly-scope";

export function registerThemeVariable(
  commands: ConsoleNamespace,
  root: ParentNode = document
): RegistrationHandle {
  return commands.registerVariable("theme", {
    type: "enum",
    description: "Theme of the page, light, dark or auto to follow the system",
    enumValues: THEME_MODES,
    get: () => {
      const theme = root.querySelector(kScopeSelector)?.getAttribute("theme");

      return theme === "light" || theme === "dark" ? theme : "auto";
    },
    set: (theme) => {
      const scopes = root.querySelectorAll(kScopeSelector);
      if (scopes.length === 0) {
        throw new Error("This page has no jolly-scope to theme");
      }

      for (const scope of scopes) {
        if (theme === "auto") {
          scope.removeAttribute("theme");
        }
        else {
          scope.setAttribute("theme", theme);
        }
      }
    }
  });
}
