// Import Internal Dependencies
import { ROOT_DIR } from "../workspace/root.ts";
import { WorkspaceProject } from "../workspace/WorkspaceProject.ts";
import { WorkspaceDescriptions } from "./WorkspaceDescriptions.ts";

const problems = [
  ...new WorkspaceDescriptions(ROOT_DIR, WorkspaceProject.all()).problems()
];
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}
