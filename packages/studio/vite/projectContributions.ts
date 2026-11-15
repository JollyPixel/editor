// Import Third-party Dependencies
import type { Plugin } from "vite";
import { createProjectContributionsPlugin } from "@jolly-pixel/asset-server/node";
import type { StudioProject } from "@jolly-pixel/server/node";

export function projectContributions(
  project: StudioProject
): Plugin {
  return createProjectContributionsPlugin(
    project.kinds,
    Array.from(project.editors, (editor) => editor.package)
  );
}
