// Import Third-party Dependencies
import type {
  ConsoleNamespace,
  RegistrationHandle
} from "@jolly-pixel/console";
import type {
  Density,
  ThemeMode
} from "@jolly-pixel/ui";

// CONSTANTS
export const THEME_MODES: readonly ThemeMode[] = Object.freeze([
  "light",
  "dark",
  "auto"
]);
export const DENSITIES: readonly Density[] = Object.freeze([
  "compact",
  "default",
  "comfortable"
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
      const theme = root.querySelector(
        kScopeSelector
      )?.getAttribute("theme");

      return theme === "light" || theme === "dark"
        ? theme
        : "auto";
    },
    set: (theme) => {
      for (const scope of scopesOf(root)) {
        if (theme === "auto") {
          scope.removeAttribute("theme");
        }
        else {
          scope.setAttribute(
            "theme",
            theme
          );
        }
      }
    }
  });
}

export function registerDensityVariable(
  commands: ConsoleNamespace,
  root: ParentNode = document
): RegistrationHandle {
  return commands.registerVariable("density", {
    type: "enum",
    description: "Density of the page, compact, default or comfortable",
    enumValues: DENSITIES,
    get: () => {
      const density = root
        .querySelector(kScopeSelector)
        ?.getAttribute("density");

      return density === "compact" || density === "comfortable" ?
        density :
        "default";
    },
    set: (density) => {
      for (const scope of scopesOf(root)) {
        scope.setAttribute(
          "density",
          density
        );
      }
    }
  });
}

function scopesOf(
  root: ParentNode
): NodeListOf<Element> {
  const scopes = root.querySelectorAll(kScopeSelector);
  if (scopes.length === 0) {
    throw new Error("This page has no jolly-scope");
  }

  return scopes;
}
