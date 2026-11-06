// Import Internal Dependencies
import { ROOT_DIR } from "../workspace/root.ts";
import { WorkspaceProject } from "../workspace/WorkspaceProject.ts";
import { AgentInstructions } from "./AgentInstructions.ts";

const problems = [
  ...new AgentInstructions(
    ROOT_DIR,
    WorkspaceProject.all().map((project) => project.directory)
  ).problems()
];
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}
