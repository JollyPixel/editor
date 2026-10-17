// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Internal Dependencies
import type { WorkspaceProject } from "../workspace/WorkspaceProject.ts";

// CONSTANTS
const kSubpathSegment = /^[a-z][a-z0-9-]*$/;

interface ConditionalTarget {
  types: string;
  default: string;
}

export class ExportsManifest {
  static* #subpathProblems(
    subpath: string
  ): IterableIterator<string> {
    if (subpath === ".") {
      return;
    }

    const [dot, ...segments] = subpath.split("/");
    if (dot !== "." || segments.length === 0) {
      yield `"${subpath}" must start with "./"`;
    }
    else if (!segments.every((segment) => kSubpathSegment.test(segment))) {
      yield `"${subpath}" must use lowercase names with no extension or wildcard`;
    }
  }

  static #isConditionalTarget(
    target: unknown
  ): target is ConditionalTarget {
    return typeof target === "object" &&
      target !== null &&
      Object.keys(target).length === 2 &&
      "types" in target &&
      typeof target.types === "string" &&
      "default" in target &&
      typeof target.default === "string";
  }

  readonly project: WorkspaceProject;

  constructor(
    project: WorkspaceProject
  ) {
    this.project = project;
  }

  * problems(): IterableIterator<string> {
    for (const problem of this.#manifestProblems()) {
      yield `${this.project.manifest.name}: ${problem}`;
    }
  }

  * #manifestProblems(): IterableIterator<string> {
    const { manifest } = this.project;
    if (manifest.exports === undefined) {
      if (manifest.private !== true) {
        yield "published packages must declare \"exports\"";
      }

      return;
    }

    if (manifest.main !== undefined || manifest.types !== undefined) {
      yield "drop \"main\" and \"types\" in favor of \"exports\"";
    }
    if (!Object.hasOwn(manifest.exports, ".")) {
      yield "\"exports\" must declare \".\"";
    }
    for (const [subpath, target] of Object.entries(manifest.exports)) {
      yield* ExportsManifest.#subpathProblems(subpath);
      yield* this.#targetProblems(subpath, target);
    }
  }

  * #targetProblems(
    subpath: string,
    target: unknown
  ): IterableIterator<string> {
    if (typeof target === "string") {
      if (!target.startsWith("./src/") || !target.endsWith(".ts") || !this.#exists(target)) {
        yield `"${subpath}" string target must be an existing ./src/*.ts file`;
      }

      return;
    }
    if (!ExportsManifest.#isConditionalTarget(target)) {
      yield `"${subpath}" target must be { types, default }`;

      return;
    }

    if (Object.keys(target)[0] !== "types") {
      yield `"${subpath}" must list "types" before "default"`;
    }
    if (target.types !== target.default.replace(/\.js$/, ".d.ts")) {
      yield `"${subpath}" types must mirror its default target`;
    }

    const source = target.default.startsWith("./dist/") ?
      target.default.replace("./dist/", "./src/").replace(/\.js$/, ".ts") :
      target.default;
    if (!this.#exists(source)) {
      yield `"${subpath}" has no source file for ${target.default}`;
    }
  }

  #exists(
    relativePath: string
  ): boolean {
    return fs.existsSync(path.join(this.project.directory, relativePath));
  }
}
