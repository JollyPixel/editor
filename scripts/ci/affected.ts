// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Internal Dependencies
import { WorkspaceProject } from "../workspace/WorkspaceProject.ts";
import { ChangeSet } from "./ChangeSet.ts";
import { E2ESuite } from "./E2ESuite.ts";

function pnpmFilters(
  projects: WorkspaceProject[],
  suffix: string
): string {
  return projects
    .map((project) => `--filter=${project.manifest.name}${suffix}`)
    .join(" ");
}

const { values } = parseArgs({
  options: {
    base: {
      type: "string"
    },
    "skip-e2e": {
      type: "string",
      multiple: true,
      default: []
    }
  }
});

const skipped = new Set(values["skip-e2e"]);
const selectors = ChangeSet.since(values.base)?.selectors() ?? null;
const projects = selectors === null ?
  WorkspaceProject.all() :
  WorkspaceProject.selected(selectors, ChangeSet.workspaceLocalPatterns);
const suites = projects
  .filter((project) => !skipped.has(project.manifest.name))
  .map((project) => E2ESuite.read(project))
  .filter((suite) => suite !== null);

console.log(`e2e=${JSON.stringify(suites)}`);
console.log(`test=${pnpmFilters(projects, "")}`);
console.log(`build=${pnpmFilters(projects, "...")}`);
