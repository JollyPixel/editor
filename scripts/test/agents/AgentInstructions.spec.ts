// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  after,
  describe,
  it
} from "node:test";

// Import Internal Dependencies
import { AgentInstructions } from "../../agents/AgentInstructions.ts";

// CONSTANTS
const kRoots: string[] = [];
const kRoutedInstructions = [
  "# Repository instructions",
  "",
  "- Build e2e suites on `packages/b` helpers.",
  "- These workspaces have an `AGENTS.md`; read it before changing them:",
  "  `packages/a`.",
  "",
  "## Windows",
  ""
].join("\r\n");

type FileTree = Record<string, string>;

function project(
  files: FileTree
): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "agent-instructions-"));
  kRoots.push(root);
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }

  return root;
}

function collectProblems(
  files: FileTree
): string[] {
  const root = project(files);

  return [
    ...new AgentInstructions(
      root,
      ["packages/a", "packages/b"].map((workspace) => path.join(root, workspace))
    ).problems()
  ];
}

describe("AgentInstructions", () => {
  after(() => {
    for (const root of kRoots) {
      fs.rmSync(root, { recursive: true });
    }
  });

  it("accepts identical skill copies and a routing list matching the workspace files", () => {
    assert.deepStrictEqual(collectProblems({
      "AGENTS.md": kRoutedInstructions,
      "packages/a/AGENTS.md": "# AGENTS.md",
      ".agents/skills/audit/SKILL.md": "same",
      ".claude/skills/audit/SKILL.md": "same"
    }), []);
  });

  it("reports a skill file that differs or exists in only one copy", () => {
    assert.deepStrictEqual(collectProblems({
      "AGENTS.md": kRoutedInstructions,
      "packages/a/AGENTS.md": "# AGENTS.md",
      ".agents/skills/audit/SKILL.md": "new",
      ".claude/skills/audit/SKILL.md": "old",
      ".agents/skills/audit/CAMPAIGN.md": "only here"
    }), [
      "skills: \"audit/CAMPAIGN.md\" exists in only one of .agents/skills and .claude/skills",
      "skills: \"audit/SKILL.md\" differs between .agents/skills and .claude/skills"
    ]);
  });

  it("reports an AGENTS.md the routing list omits, even when its path appears elsewhere", () => {
    assert.deepStrictEqual(collectProblems({
      "AGENTS.md": kRoutedInstructions,
      "packages/a/AGENTS.md": "# AGENTS.md",
      "packages/b/AGENTS.md": "# AGENTS.md"
    }), [
      "AGENTS.md: \"packages/b/AGENTS.md\" is missing from the root routing list"
    ]);
  });

  it("reports a routed workspace that has no AGENTS.md", () => {
    assert.deepStrictEqual(collectProblems({
      "AGENTS.md": kRoutedInstructions
    }), [
      "AGENTS.md: the root routing list names \"packages/a\", which has no AGENTS.md"
    ]);
  });
});
