// Import Internal Dependencies
import { WorkspaceProject } from "../workspace/WorkspaceProject.ts";
import { ExportsManifest } from "./ExportsManifest.ts";

const problems = WorkspaceProject.all()
  .flatMap((project) => [...new ExportsManifest(project).problems()]);
if (problems.length > 0) {
  console.error(problems.join("\n"));
  process.exitCode = 1;
}
