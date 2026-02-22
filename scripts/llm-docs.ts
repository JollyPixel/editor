// Import Node.js Dependencies
import path from "node:path";
import fs from "node:fs";

// CONSTANTS
const __dirname = import.meta.dirname;
const kLLDocFolder = path.join(__dirname, "..", "docs", "llms");

/**
 * Recursively walk a directory synchronously and return absolute paths
 * for files matching provided extensions (case-insensitive).
 */
function walkMarkdownSync(
  root: string,
  extensions = new Set([".md", ".MD"])
): string[] {
  if (!fs.existsSync(root)) {
    return [];
  }

  const exts = new Set(Array.from(extensions).map((e) => e.toLowerCase()));
  const results: string[] = [];

  const entries = fs.readdirSync(root, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkMarkdownSync(full, extensions));
    }
    else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (exts.has(ext)) {
        results.push(full);
      }
    }
  }

  return results;
}

const [workspace] = process.argv.slice(2);

if (!workspace) {
  console.error("Usage: node llm-docs.js <workspace>");
  process.exit(1);
}

generateDocs(workspace);

function generateDocs(
  workspace: string
) {
  const workspaceRoot = path.join(__dirname, "..", "packages", workspace);
  if (!fs.existsSync(workspaceRoot)) {
    throw new Error(`Workspace directory not found at ${workspaceRoot}`);
  }

  const docsDir = path.join(workspaceRoot, "docs");

  const docs = walkMarkdownSync(docsDir, new Set([".md", ".MD"]));
  const architectureMD = path.join(workspaceRoot, "ARCHITECTURE.md");
  if (fs.existsSync(architectureMD)) {
    docs.unshift(architectureMD);
  }
  docs.unshift(path.join(workspaceRoot, "README.md"));

  let fullLLMDocs = "";
  for (const docPath of docs) {
    console.log(docPath);
    const content = fs.readFileSync(docPath, "utf-8");
    fullLLMDocs += `# ${path.basename(docPath)}\n\n${content}\n\n`;
  }

  const fileName = path.basename(workspaceRoot);
  fs.writeFileSync(
    path.join(kLLDocFolder, `${fileName}-llms-full.md`),
    fullLLMDocs,
    "utf-8"
  );
}
