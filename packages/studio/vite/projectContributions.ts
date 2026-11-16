// Import Third-party Dependencies
import type { Plugin } from "vite";
import { createProjectContributionsPlugin } from "@jolly-pixel/asset-server/node";
import type { Project } from "@jolly-pixel/server/node";

export function projectContributions(
  project: Project
): Plugin {
  return createProjectContributionsPlugin(
    project.kinds,
    Array.from(project.editors, (editor) => editor.package)
  );
}
