// Import Node.js Dependencies
import { spawn } from "node:child_process";
import { once } from "node:events";

// Import Internal Dependencies
import { TSC_PATH } from "../typescript/tsc.ts";
import { WorkspaceProject } from "../workspace/WorkspaceProject.ts";

// CONSTANTS
const kTscBuild = /^tsc -b(?: && (?<after>.+))?$/;

async function exitCode(
  command: string,
  args: readonly string[],
  cwd?: string
): Promise<number> {
  const child = spawn(command, args, {
    cwd,
    shell: cwd !== undefined,
    stdio: "inherit"
  });
  const [code] = await once(child, "close");

  return code ?? 1;
}

const libraries = WorkspaceProject.all().flatMap((project) => {
  const match = kTscBuild.exec(project.manifest.scripts?.build ?? "");

  return match === null ? [] : [{ project, after: match.groups?.after }];
});

process.exitCode = await exitCode(process.execPath, [
  TSC_PATH,
  "-b",
  ...libraries.map(({ project }) => project.directory)
]);
for (const { project, after } of libraries) {
  if (process.exitCode !== 0) {
    break;
  }
  if (after !== undefined) {
    process.exitCode = await exitCode(after, [], project.directory);
  }
}
